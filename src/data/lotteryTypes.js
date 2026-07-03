// ============================================================
// Configuración central de todos los tipos de rifas soportados
// ─ Sin sorteos/días: cada jugada lleva su propia fecha opcional
// ============================================================

export let LOTTERY_TYPES = {
  la_tica: {
    id: 'la_tica',
    name: 'La Tica',
    emoji: '',
    color: '#4f46e5',
    gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
    description: 'Lotería nacional de Costa Rica',
    numberRange: { min: 0, max: 99 },
    numberDigits: 2,
    extraFields: [],
    defaultPrice: 500,
    priceLabel: 'NIO ',
    currency: 'NIO',
    payoutMultiplier: 80.00,
  },

  la_hondurena: {
    id: 'la_hondurena',
    name: 'La Hondureña',
    emoji: '',
    color: '#0891b2',
    gradient: 'linear-gradient(135deg, #0891b2, #0e7490)',
    description: 'Lotería nacional de Honduras',
    numberRange: { min: 0, max: 99 },
    numberDigits: 2,
    extraFields: [],
    defaultPrice: 25,
    priceLabel: 'NIO ',
    currency: 'NIO',
    payoutMultiplier: 80.00,
  },

  juega3: {
    id: 'juega3',
    name: 'Juega 3 Diaria',
    emoji: '',
    color: '#16a34a',
    gradient: 'linear-gradient(135deg, #16a34a, #15803d)',
    description: 'Tres dígitos, sorteo diario',
    numberRange: { min: 0, max: 999 },
    numberDigits: 3,
    extraFields: [],
    defaultPrice: 100,
    priceLabel: 'NIO ',
    currency: 'NIO',
    payoutMultiplier: 80.00,
  },

  pega4: {
    id: 'pega4',
    name: 'Pega 4',
    emoji: '',
    color: '#d97706',
    gradient: 'linear-gradient(135deg, #d97706, #b45309)',
    description: 'Cuatro dígitos',
    numberRange: { min: 0, max: 9999 },
    numberDigits: 4,
    extraFields: [],
    defaultPrice: 100,
    priceLabel: 'NIO ',
    currency: 'NIO',
    payoutMultiplier: 80.00,
  },

  fechea: {
    id: 'fechea',
    name: 'Fechea',
    emoji: '',
    color: '#dc2626',
    gradient: 'linear-gradient(135deg, #dc2626, #b91c1c)',
    description: 'Apuesta a fecha especial',
    numberRange: null,
    numberDigits: null,
    extraFields: [],
    defaultPrice: 200,
    priceLabel: 'NIO ',
    currency: 'NIO',
    payoutMultiplier: 80.00,
  },
};

export let LOTTERY_LIST = Object.values(LOTTERY_TYPES);
export const getLotteryById = (id) => LOTTERY_TYPES[id] || null;

/**
 * Permite registrar y fusionar dinámicamente los juegos cargados desde la base de datos
 */
export const setDynamicLotteries = (configs) => {
  const presets = {
    la_tica: {
      id: 'la_tica',
      name: 'La Tica',
      emoji: '',
      color: '#4f46e5',
      gradient: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
      description: 'Lotería nacional de Costa Rica',
      numberRange: { min: 0, max: 99 },
      numberDigits: 2,
      extraFields: [],
      defaultPrice: 500,
      priceLabel: 'NIO ',
      currency: 'NIO',
      payoutMultiplier: 80.00,
    },
    la_hondurena: {
      id: 'la_hondurena',
      name: 'La Hondureña',
      emoji: '',
      color: '#0891b2',
      gradient: 'linear-gradient(135deg, #0891b2, #0e7490)',
      description: 'Lotería nacional de Honduras',
      numberRange: { min: 0, max: 99 },
      numberDigits: 2,
      extraFields: [],
      defaultPrice: 25,
      priceLabel: 'NIO ',
      currency: 'NIO',
      payoutMultiplier: 80.00,
    },
    juega3: {
      id: 'juega3',
      name: 'Juega 3 Diaria',
      emoji: '',
      color: '#16a34a',
      gradient: 'linear-gradient(135deg, #16a34a, #15803d)',
      description: 'Tres dígitos, sorteo diario',
      numberRange: { min: 0, max: 999 },
      numberDigits: 3,
      extraFields: [],
      defaultPrice: 100,
      priceLabel: 'NIO ',
      currency: 'NIO',
      payoutMultiplier: 80.00,
    },
    pega4: {
      id: 'pega4',
      name: 'Pega 4',
      emoji: '',
      color: '#d97706',
      gradient: 'linear-gradient(135deg, #d97706, #b45309)',
      description: 'Cuatro dígitos',
      numberRange: { min: 0, max: 9999 },
      numberDigits: 4,
      extraFields: [],
      defaultPrice: 100,
      priceLabel: 'NIO ',
      currency: 'NIO',
      payoutMultiplier: 80.00,
    },
    fechea: {
      id: 'fechea',
      name: 'Fechea',
      emoji: '',
      color: '#dc2626',
      gradient: 'linear-gradient(135deg, #dc2626, #b91c1c)',
      description: 'Apuesta a fecha especial',
      numberRange: null,
      numberDigits: null,
      extraFields: [],
      defaultPrice: 200,
      priceLabel: 'NIO ',
      currency: 'NIO',
      payoutMultiplier: 80.00,
    },
  };

  // 1. Fusionar las configuraciones personalizadas de los presets estáticos
  Object.keys(presets).forEach((key) => {
    const dbCfg = configs[key];
    if (dbCfg) {
      presets[key] = {
        ...presets[key],
        name:             dbCfg.name              || presets[key].name,
        description:      dbCfg.description       || presets[key].description,
        defaultPrice:     dbCfg.default_price !== null ? parseFloat(dbCfg.default_price) : presets[key].defaultPrice,
        priceLabel:       dbCfg.price_label       || presets[key].priceLabel,
        payoutMultiplier: dbCfg.payout_multiplier !== null ? parseFloat(dbCfg.payout_multiplier) : presets[key].payoutMultiplier,
        enabled:          Boolean(Number(dbCfg.enabled)),
        allowSeries:      Boolean(Number(dbCfg.allow_series ?? 0)),
        allowMultiDraw:   Boolean(Number(dbCfg.allow_multi_draw ?? 0)),
        drawHours:        dbCfg.draw_hours        || '12:00,15:00,18:00,21:00',
        maxSalesPerNumber: dbCfg.max_sales_per_number !== null ? parseFloat(dbCfg.max_sales_per_number) : 0.00,
      };
    } else {
      presets[key].enabled = true;
      presets[key].allowSeries = false;
      presets[key].allowMultiDraw = false;
      presets[key].drawHours = '12:00,15:00,18:00,21:00';
      presets[key].maxSalesPerNumber = 0.00;
    }
  });

  // 2. Insertar juegos completamente personalizados creados por el admin
  Object.values(configs).forEach((dbCfg) => {
    if (Number(dbCfg.is_custom) === 1 && !presets[dbCfg.lottery_id]) {
      presets[dbCfg.lottery_id] = {
        id:               dbCfg.lottery_id,
        name:             dbCfg.name,
        emoji:            dbCfg.emoji || '',
        color:            '#7c3aed',
        gradient:         'linear-gradient(135deg, #7c3aed, #4f46e5)',
        description:      dbCfg.description || 'Juego personalizado',
        numberRange:      dbCfg.number_digits !== null ? { min: Number(dbCfg.min_number ?? 0), max: Number(dbCfg.max_number ?? 99) } : null,
        numberDigits:     dbCfg.number_digits !== null ? Number(dbCfg.number_digits) : 2,
        extraFields:      [],
        defaultPrice:     parseFloat(dbCfg.default_price || 100),
        priceLabel:       dbCfg.price_label || 'NIO ',
        currency:         'NIO',
        payoutMultiplier: parseFloat(dbCfg.payout_multiplier || 80.00),
        enabled:          Boolean(Number(dbCfg.enabled)),
        allowSeries:      Boolean(Number(dbCfg.allow_series ?? 0)),
        allowMultiDraw:   Boolean(Number(dbCfg.allow_multi_draw ?? 0)),
        isCustom:         true,
        drawHours:        dbCfg.draw_hours        || '12:00,15:00,18:00,21:00',
        maxSalesPerNumber: dbCfg.max_sales_per_number !== null ? parseFloat(dbCfg.max_sales_per_number) : 0.00,
      };
    }
  });

  LOTTERY_TYPES = presets;
  LOTTERY_LIST = Object.values(presets);
};

/**
 * Valida una jugada individual.
 */
export const validateJugada = (lotteryId, jugada) => {
  const lottery = getLotteryById(lotteryId);
  if (!lottery) return ['Tipo de rifa inválido'];
  const errors = [];

  if (lotteryId !== 'fechea') {
    if (jugada.numero === undefined || jugada.numero === '') {
      errors.push('El número es requerido');
    } else {
      const numStr = String(jugada.numero).trim();
      if (!/^\d+$/.test(numStr)) {
        errors.push('El número debe contener únicamente dígitos');
      } else {
        if (lottery.numberDigits && numStr.length > lottery.numberDigits) {
          errors.push(`El número no puede tener más de ${lottery.numberDigits} dígitos`);
        }
        if (lottery.numberRange) {
          const n = parseInt(numStr, 10);
          if (isNaN(n) || n < lottery.numberRange.min || n > lottery.numberRange.max) {
            errors.push(`Número fuera de rango (${lottery.numberRange.min}–${lottery.numberRange.max})`);
          }
        }
      }
    }
  } else {
    if (!jugada.fecha) errors.push('La fecha es requerida');
  }

  if (!jugada.monto || parseFloat(jugada.monto) <= 0) {
    errors.push('El monto debe ser mayor a 0');
  }

  return errors;
};

/**
 * Formatea un número con ceros a la izquierda según el tipo de rifa.
 */
export const formatLotteryNumber = (lotteryId, number) => {
  const lottery = getLotteryById(lotteryId);
  if (!lottery || !lottery.numberDigits) return String(number);
  return String(number).padStart(lottery.numberDigits, '0');
};
