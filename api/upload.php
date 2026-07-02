<?php
// POST /api/upload.php → Subir imagen de carrusel (solo admin)
require_once __DIR__ . '/helpers.php';
cors();
$user = requireAdmin();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_FILES['image'])) {
        fail('No se subió ninguna imagen.');
    }
    
    $file = $_FILES['image'];
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    if (!in_array(strtolower($ext), $allowed)) {
        fail('Formato de imagen no permitido (solo JPG, PNG, GIF, WEBP).');
    }
    
    // Validar tamaño máximo (5MB)
    if ($file['size'] > 5 * 1024 * 1024) {
        fail('La imagen supera el límite permitido de 5MB.');
    }
    
    $uploadDir = __DIR__ . '/../uploads/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    
    $filename = 'carousel_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $target = $uploadDir . $filename;
    
    if (move_uploaded_file($file['tmp_name'], $target)) {
        // Guardamos solo la ruta relativa para que web y mobile
        // puedan construir la URL completa según su propio servidor.
        // Formato: /uploads/carousel_xxx.jpg
        $scriptName = $_SERVER['SCRIPT_NAME'];
        $baseDir = rtrim(str_replace('/api/upload.php', '', $scriptName), '/');
        $relativePath = $baseDir . '/uploads/' . $filename;
        
        ok(['url' => $relativePath]);
    } else {
        fail('Error al guardar la imagen en el servidor.');
    }
}

fail('Método no permitido.', 405);
