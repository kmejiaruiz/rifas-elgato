<?php
// GET  /api/sales.php           → listar boletos con jugadas
// GET  /api/sales.php?summary=1 → resumen del día
// POST /api/sales.php           → crear boleto con jugadas
// PUT  /api/sales.php?id=X      → anular boleto
// DELETE /api/sales.php         → borrar todo (admin)
require_once __DIR__ . '/helpers.php';
cors();

$method = $_SERVER['REQUEST_METHOD'];
$db     = getDB();

// ─── Listar / Resumen ─────────────────────────────────────────
if ($method === 'GET') {
    $user = requireAuth();

    // Resumen del día
    if (isset($_GET['summary'])) {
        $today = date('Y-m-d');
        
        $sqlRows = "SELECT s.status, sl.monto
            FROM sales s
            JOIN sale_lines sl ON sl.sale_id = s.id
            WHERE DATE(s.created_at) = ?";
        $paramsRows = [$today];
        if ($user['role'] !== 'admin') {
            $sqlRows .= " AND s.seller_id = ?";
            $paramsRows[] = $user['id'];
        }
        $rows = $db->prepare($sqlRows);
        $rows->execute($paramsRows);
        $all = $rows->fetchAll();

        $total = 0; $count = 0; $cancelled = 0; $byType = [];
        foreach ($all as $row) {
            if ($row['status'] === 'active') {
                $total += (float)$row['monto'];
            }
        }
        
        // Contar boletos activos únicos por tipo
        $sqlBc = "SELECT lottery_id, COUNT(*) as cnt FROM sales WHERE DATE(created_at) = ? AND status = 'active'";
        $paramsBc = [$today];
        if ($user['role'] !== 'admin') {
            $sqlBc .= " AND seller_id = ?";
            $paramsBc[] = $user['id'];
        }
        $sqlBc .= " GROUP BY lottery_id";
        $bc = $db->prepare($sqlBc);
        $bc->execute($paramsBc);
        foreach ($bc->fetchAll() as $r) {
            $byType[$r['lottery_id']] = ['count' => (int)$r['cnt'], 'total' => 0];
        }
        
        // Total por tipo
        $sqlBt = "SELECT s.lottery_id, SUM(sl.monto) as tot
            FROM sales s JOIN sale_lines sl ON sl.sale_id = s.id
            WHERE DATE(s.created_at) = ? AND s.status = 'active'";
        $paramsBt = [$today];
        if ($user['role'] !== 'admin') {
            $sqlBt .= " AND s.seller_id = ?";
            $paramsBt[] = $user['id'];
        }
        $sqlBt .= " GROUP BY s.lottery_id";
        $bt = $db->prepare($sqlBt);
        $bt->execute($paramsBt);
        foreach ($bt->fetchAll() as $r) {
            if (isset($byType[$r['lottery_id']])) $byType[$r['lottery_id']]['total'] = (float)$r['tot'];
        }
        
        $count = array_sum(array_column($byType, 'count'));
        
        // Boletos anulados
        $sqlCan = "SELECT COUNT(*) FROM sales WHERE DATE(created_at) = ? AND status = 'cancelled'";
        $paramsCan = [$today];
        if ($user['role'] !== 'admin') {
            $sqlCan .= " AND seller_id = ?";
            $paramsCan[] = $user['id'];
        }
        $cancelledQuery = $db->prepare($sqlCan);
        $cancelledQuery->execute($paramsCan);
        $cancelled = (int)$cancelledQuery->fetchColumn();
        
        ok(compact('total', 'count', 'cancelled', 'byType'));
    }

    // Filtros
    $where = ['1=1']; $params = [];
    
    // Filtro estricto por vendedor para no-admins
    if ($user['role'] !== 'admin') {
        $where[] = 's.seller_id = ?';
        $params[] = $user['id'];
    } else {
        // Admins pueden filtrar opcionalmente por vendedor
        if (!empty($_GET['seller_id'])) {
            $where[] = 's.seller_id = ?';
            $params[] = $_GET['seller_id'];
        }
    }
    
    if (!empty($_GET['date'])) {
        $where[] = 'DATE(s.created_at) = ?';
        $params[] = $_GET['date'];
    }
    if (!empty($_GET['lottery_id'])) {
        $where[] = 's.lottery_id = ?';
        $params[] = $_GET['lottery_id'];
    }
    if (!empty($_GET['status'])) {
        if ($_GET['status'] === 'winner') {
            $where[] = "EXISTS (SELECT 1 FROM sale_lines sl2 WHERE sl2.sale_id = s.id AND sl2.status = 'winner')";
        } else {
            $where[] = 's.status = ?';
            $params[] = $_GET['status'];
        }
    }
    if (!empty($_GET['search'])) {
        $q = '%'.$_GET['search'].'%';
        $where[] = '(s.comprador LIKE ? OR sl.numero LIKE ?)';
        array_push($params, $q, $q);
    }

    $sql = "SELECT DISTINCT s.* FROM sales s
            LEFT JOIN sale_lines sl ON sl.sale_id = s.id
            WHERE ".implode(' AND ', $where)."
            ORDER BY s.created_at DESC LIMIT 200";
    $st = $db->prepare($sql);
    $st->execute($params);
    $sales = $st->fetchAll();

    // Cargar jugadas
    $ids    = array_column($sales, 'id');
    $linesMap = loadLines($db, $ids);
    $result = array_map(fn($s) => normalizeSale($s, $linesMap[$s['id']] ?? []), $sales);

    ok(['sales' => $result]);
}

// ─── Crear boleto con jugadas ─────────────────────────────────
if ($method === 'POST') {
    $user = requireAuth();
    $b    = body();

    $lotteryId  = trim($b['lotteryId']  ?? '');
    $jugadas    = $b['jugadas']    ?? [];
    $comprador  = trim($b['comprador']  ?? '');
    $horaSorteo = trim($b['horaSorteo'] ?? '12:00');

    if (!$lotteryId)      fail('lotteryId es requerido.');
    if (empty($jugadas))  fail('Debe incluir al menos una jugada.');

    // Verificar juego habilitado y obtener configuraciones de riesgo
    $gc = $db->prepare("SELECT enabled, draw_hours, max_sales_per_number, price_label, number_digits, min_number, max_number FROM game_configs WHERE lottery_id = ?");
    $gc->execute([$lotteryId]);
    $cfg = $gc->fetch();
    
    if ($cfg) {
        if (!$cfg['enabled']) fail('Este juego está deshabilitado.');
        
        // Validar que la hora del sorteo esté permitida para este juego
        $allowedHours = array_map('trim', explode(',', $cfg['draw_hours'] ?: '12:00,15:00,18:00,21:00'));
        if (!in_array($horaSorteo, $allowedHours)) {
            fail("La hora de sorteo $horaSorteo no está permitida para este juego.");
        }
    }

    // Verificar hora de cierre de sorteo
    $settQ = $db->prepare("SELECT value FROM app_settings WHERE `key` = 'drawCloseMinutes'");
    $settQ->execute();
    $closeMinVal = $settQ->fetchColumn();
    $drawCloseMinutes = $closeMinVal !== false ? (int)$closeMinVal : 10;

    $drawDate = trim($b['drawDate'] ?? '');
    if (!$drawDate) {
        $drawDate = date('Y-m-d');
        if ($lotteryId !== 'fechea') {
            foreach ($jugadas as $j) {
                if (!empty($j['fecha'])) {
                    $drawDate = $j['fecha'];
                    break;
                }
            }
        }
    }

    $drawDateTimeStr = $drawDate . ' ' . $horaSorteo . ':00';
    $drawTime = strtotime($drawDateTimeStr);
    $currentTime = time();
    $closeLimitTime = $drawTime - ($drawCloseMinutes * 60);

    if ($currentTime >= $closeLimitTime) {
        $hourObj = DateTime::createFromFormat('H:i', $horaSorteo);
        $horaAmPm = $hourObj ? $hourObj->format('g:i A') : $horaSorteo;
        fail("La venta para el sorteo de las $horaAmPm está desactivada por sorteo.");
    }

    // Verificar números bloqueados
    $blockedQ = $db->prepare("SELECT numero FROM blocked_numbers WHERE lottery_id = ?");
    $blockedQ->execute([$lotteryId]);
    $blocked = array_column($blockedQ->fetchAll(), 'numero');

    // Fallbacks para presets estáticos en PHP si no están configurados en game_configs
    $presetDigits = [
        'la_tica' => 2,
        'la_hondurena' => 2,
        'juega3' => 3,
        'pega4' => 4,
    ];
    $presetMin = [
        'la_tica' => 0,
        'la_hondurena' => 0,
        'juega3' => 0,
        'pega4' => 0,
    ];
    $presetMax = [
        'la_tica' => 99,
        'la_hondurena' => 99,
        'juega3' => 999,
        'pega4' => 9999,
    ];

    $digitsLimit = null;
    $minNum = null;
    $maxNum = null;

    if ($cfg) {
        $digitsLimit = isset($cfg['number_digits']) ? (int)$cfg['number_digits'] : null;
        $minNum = isset($cfg['min_number']) ? (int)$cfg['min_number'] : null;
        $maxNum = isset($cfg['max_number']) ? (int)$cfg['max_number'] : null;
    }

    if ($digitsLimit === null && isset($presetDigits[$lotteryId])) {
        $digitsLimit = $presetDigits[$lotteryId];
    }
    if ($minNum === null && isset($presetMin[$lotteryId])) {
        $minNum = $presetMin[$lotteryId];
    }
    if ($maxNum === null && isset($presetMax[$lotteryId])) {
        $maxNum = $presetMax[$lotteryId];
    }

    foreach ($jugadas as $j) {
        $num = trim((string)($j['numero'] ?? ''));
        if ($lotteryId !== 'fechea') {
            if ($num === '') {
                fail('El número es requerido.');
            }
            if ($digitsLimit !== null && strlen($num) > $digitsLimit) {
                fail("El número $num excede la cantidad máxima de dígitos permitida ($digitsLimit).");
            }
            if ($minNum !== null && $maxNum !== null) {
                if (!ctype_digit($num)) {
                    fail("El número $num debe contener únicamente dígitos decimales.");
                }
                $val = (int)$num;
                if ($val < $minNum || $val > $maxNum) {
                    fail("El número $num está fuera del rango permitido ($minNum-$maxNum).");
                }
            }
        }
        if ($num !== '' && in_array($num, $blocked)) {
            fail("El número $num está cerrado para este juego.");
        }
        if (!isset($j['monto']) || (float)$j['monto'] <= 0) {
            fail('Cada jugada debe tener un monto mayor a 0.');
        }
    }

    // Acumular montos por número de la petición actual
    $reqAmounts = [];
    foreach ($jugadas as $j) {
        $isFechea = ($lotteryId === 'fechea');
        $numero = $isFechea ? (string)($j['fecha'] ?? '') : (string)($j['numero'] ?? '');
        if (!isset($reqAmounts[$numero])) {
            $reqAmounts[$numero] = 0.00;
        }
        $reqAmounts[$numero] += (float)($j['monto'] ?? 0);
    }

    // Verificar límites máximos de venta por número
    $maxLimit = $cfg ? (float)$cfg['max_sales_per_number'] : 0.00;
    if ($maxLimit > 0) {
        foreach ($reqAmounts as $num => $reqMonto) {
            // Consultar ventas acumuladas activas para este número, juego, fecha y hora de sorteo
            $sumQ = $db->prepare("
                SELECT COALESCE(SUM(sl.monto), 0)
                FROM sale_lines sl
                JOIN sales s ON sl.sale_id = s.id
                WHERE sl.lottery_id = ?
                  AND sl.numero = ?
                  AND sl.fecha = ?
                  AND s.hora_sorteo = ?
                  AND s.status = 'active'
            ");
            $sumQ->execute([$lotteryId, $num, $drawDate, $horaSorteo]);
            $currentAccumulated = (float)$sumQ->fetchColumn();

            if ($currentAccumulated + $reqMonto > $maxLimit) {
                $available = $maxLimit - $currentAccumulated;
                $available = $available < 0 ? 0 : $available;
                $priceLabel = ($cfg && $cfg['price_label']) ? $cfg['price_label'] : 'NIO ';

                if ($lotteryId === 'fechea') {
                    $parts = explode('/', $num);
                    $formattedNum = $num;
                    if (count($parts) >= 2) {
                        $months = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                        $formattedNum = $parts[0] . ' ' . ($months[(int)$parts[1]] ?? '');
                    }
                    fail("El límite de venta para la fecha $formattedNum en este sorteo ha sido alcanzado. Disponible: $priceLabel" . number_format($available, 2));
                } else {
                    fail("El límite de venta para el número $num en este sorteo ha sido alcanzado. Disponible: $priceLabel" . number_format($available, 2));
                }
            }
        }
    }

    $totalMonto = array_sum(array_column($jugadas, 'monto'));

    $saleId = 'sale_'.time().'_'.bin2hex(random_bytes(4));

    $db->prepare("INSERT INTO sales (id, lottery_id, comprador, monto, seller_id, seller_name, hora_sorteo)
        VALUES (?,?,?,?,?,?,?)")
       ->execute([$saleId, $lotteryId, $comprador ?: null, $totalMonto, $user['id'], $user['name'], $horaSorteo]);

    $insLine = $db->prepare("INSERT INTO sale_lines
        (sale_id, lottery_id, numero, monto, fecha, modalidad, serie, fraccion)
        VALUES (?,?,?,?,?,?,?,?)");

    foreach ($jugadas as $j) {
        $isFechea = ($lotteryId === 'fechea');
        $fecha = $isFechea ? $drawDate : (!empty($j['fecha']) ? $j['fecha'] : $drawDate);
        $numero = $isFechea ? (string)($j['fecha'] ?? '') : (string)($j['numero'] ?? '');
        $insLine->execute([
            $saleId, $lotteryId,
            $numero,
            (float)$j['monto'],
            $fecha,
            $j['modalidad'] ?? null,
            $j['serie']     ?? null,
            isset($j['fraccion']) ? (int)$j['fraccion'] : null,
        ]);
    }

    $st = $db->prepare("SELECT * FROM sales WHERE id = ?");
    $st->execute([$saleId]);
    $sale = $st->fetch();
    $linesMap = loadLines($db, [$saleId]);

    ok(['sale' => normalizeSale($sale, $linesMap[$saleId] ?? [])], 201);
}

// ─── Anular boleto o Pagar Premio ────────────────────────────────────────────
if ($method === 'PUT') {
    $user = requireAuth();
    $id   = $_GET['id'] ?? '';
    if (!$id) fail('ID requerido.');

    $st = $db->prepare("SELECT * FROM sales WHERE id = ?");
    $st->execute([$id]);
    $sale = $st->fetch();
    if (!$sale) fail('Boleto no encontrado.', 404);

    // Vendedor no puede interactuar con ventas de otros
    if ($user['role'] !== 'admin' && $sale['seller_id'] !== $user['id']) {
        fail('No tienes permiso para interactuar con esta venta.', 403);
    }

    // Pagar Premio
    if (isset($_GET['pay_prize'])) {
        if ($sale['status'] === 'cancelled') fail('No se puede pagar un boleto anulado.');
        if ($sale['prize_paid'] == 1) fail('El premio de este boleto ya ha sido pagado.');

        // Verificar si contiene al menos una jugada ganadora
        $winnerCount = $db->prepare("SELECT COUNT(*) FROM sale_lines WHERE sale_id = ? AND status = 'winner'");
        $winnerCount->execute([$id]);
        if ((int)$winnerCount->fetchColumn() === 0) {
            fail('Este boleto no contiene jugadas ganadoras.');
        }

        $db->prepare("UPDATE sales SET prize_paid = 1 WHERE id = ?")->execute([$id]);

        $st->execute([$id]);
        $linesMap = loadLines($db, [$id]);
        ok(['sale' => normalizeSale($st->fetch(), $linesMap[$id] ?? [])]);
    }

    $b = body();
    $adminUsername = trim($b['adminUsername'] ?? '');
    $adminPassword = $b['adminPassword'] ?? '';

    if ($sale['status'] === 'cancelled') fail('El boleto ya está anulado.');

    // Validar si el sorteo de alguna de las líneas del boleto ya fue anunciado
    $linesQ = $db->prepare("SELECT lottery_id, fecha FROM sale_lines WHERE sale_id = ?");
    $linesQ->execute([$id]);
    $saleLines = $linesQ->fetchAll();

    $hasAnnouncedDraw = false;
    $blockedAnnulment = false;

    foreach ($saleLines as $line) {
        $fechaSorteo = !empty($line['fecha']) ? $line['fecha'] : date('Y-m-d');
        
        $chk = $db->prepare("SELECT announced_at FROM lottery_results 
            WHERE lottery_id = ? AND fecha_sorteo = ? AND hora_sorteo = ?
            ORDER BY announced_at ASC LIMIT 1");
        $chk->execute([$line['lottery_id'], $fechaSorteo, $sale['hora_sorteo']]);
        $res = $chk->fetch();

        if ($res) {
            $hasAnnouncedDraw = true;
            // Si la venta se creó antes o al mismo tiempo que el anuncio, se bloquea por completo
            if ($sale['created_at'] <= $res['announced_at']) {
                $blockedAnnulment = true;
            }
        }
    }

    if ($blockedAnnulment) {
        fail('No se puede realizar la acción: este boleto pertenece a un sorteo que ya fue anunciado.', 403);
    }

    $requiresAdmin = ($user['role'] !== 'admin') || $hasAnnouncedDraw;
    $cancelledByName = $user['name']; // Si el usuario firmado es admin, por defecto es él

    if ($requiresAdmin) {
        if (!$adminUsername || !$adminPassword) {
            fail('Para realizar esta acción se requieren credenciales de administrador.', 403);
        }

        $admQ = $db->prepare("SELECT * FROM users WHERE username = ? AND role = 'admin' AND active = 1");
        $admQ->execute([$adminUsername]);
        $admUser = $admQ->fetch();

        if (!$admUser || !password_verify($adminPassword, $admUser['password_hash'])) {
            fail('Credenciales de administrador incorrectas.', 401);
        }

        $cancelledByName = $admUser['name'];
    }

    $db->prepare("UPDATE sales SET status = 'cancelled', cancelled_at = NOW(), cancelled_by_name = ? WHERE id = ?")
       ->execute([$cancelledByName, $id]);
    $db->prepare("UPDATE sale_lines SET status = 'cancelled' WHERE sale_id = ?")->execute([$id]);

    $st->execute([$id]);
    $linesMap = loadLines($db, [$id]);
    ok(['sale' => normalizeSale($st->fetch(), $linesMap[$id] ?? [])]);
}

// ─── Borrar todas las ventas (solo admin) ─────────────────────
if ($method === 'DELETE') {
    requireAdmin();
    $db->exec("DELETE FROM sale_lines");
    $db->exec("DELETE FROM sales");
    ok(['message' => 'Todas las ventas han sido eliminadas.']);
}

fail('Método no permitido.', 405);
