import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Platform, Share, Image, Modal, StyleSheet, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Share2 } from 'lucide-react-native';
import { COLORS, RADIUS } from '../styles/theme';
import { getLotteryById, formatLotteryNumber } from '../data/lotteryTypes';
import { formatHourAmPm } from '../services/gameService';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

// ─── Helpers localizados para independizar el componente ────────
const parseDate = (str) => {
  if (!str || typeof str !== 'string') return new Date();
  const clean = str.replace(' ', 'T');
  if (!clean.includes('Z') && !clean.includes('+') && !clean.match(/-\d{2}:\d{2}$/)) {
    return new Date(clean + 'Z');
  }
  return new Date(clean);
};

const formatDateShort = (str) => {
  if (!str) return '—';
  const d = parseDate(str);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const formatTimeShort = (str) => {
  if (!str) return '—';
  const d = parseDate(str);
  if (isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatDrawDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
};

const formatFecheaDate = (str) => {
  if (!str) return '—';
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const parts = str.split('/');
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10);
    return `${parts[0]} ${months[(m - 1)] || parts[1]}`;
  }
  return str;
};

const getFecheaPlayValue = (line) => {
  if (!line) return '';
  if (line.numero && typeof line.numero === 'string' && line.numero.includes('/')) {
    return line.numero;
  }
  if (line.fecha && typeof line.fecha === 'string' && line.fecha.includes('/')) {
    return line.fecha;
  }
  return line.numero || '';
};

const getDrawHoursText = (sale) => {
  if (sale.multiHours && Array.isArray(sale.multiHours) && sale.multiHours.length > 0) {
    return sale.multiHours.map(formatHourAmPm).join(', ');
  }
  const hr = sale.horaSorteo || sale.hora_sorteo || sale.sorteo;
  return hr ? formatHourAmPm(hr) : '';
};

export const DigitalTicketModal = ({ visible, sale, settings, onClose }) => {
  const insets = useSafeAreaInsets();
  const [currentTheme, setCurrentTheme] = useState('digital'); // 'digital' | 'thermal'
  const ticketRef = useRef(null);

  if (!sale) return null;

  const lottery = getLotteryById(sale.lotteryId || sale.lottery_id);
  const lines = sale.lines || [];
  const payoutMultiplier = parseFloat(lottery?.payoutMultiplier || 80);

  let dateStr = '—';
  let timeStr = '—';
  try {
    dateStr = formatDateShort(sale.createdAt || sale.created_at);
    timeStr = formatTimeShort(sale.createdAt || sale.created_at);
  } catch (err) {}

  const qrValidationText = `--- TICKET OFICIAL ---\nID: ${sale.id?.split('_').pop() || sale.id}\nEmpresa: ${settings.businessName || 'Zentric'}\nSorteo: ${lottery?.name || 'Rifa'}\nTotal: NIO ${parseFloat(sale.monto).toFixed(2)}\nFecha: ${dateStr} ${timeStr}\nVendedor: ${sale.sellerName || sale.seller_name || '—'}\nSello: ORIGINAL_SECURE_VAL`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrValidationText)}&margin=10`;

  // WhatsApp: Solo la imagen del boleto
  const handleShareImageOnly = async () => {
    try {
      if (!ticketRef.current) {
        Alert.alert('Error', 'El boleto no está listo para capturarse.');
        return;
      }
      const uri = await captureRef(ticketRef, {
        format: 'jpg',
        quality: 0.95,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'Compartir no está disponible en este dispositivo.');
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Compartir Imagen de Boleto',
        UTI: 'public.jpeg',
      });
    } catch (err) {
      Alert.alert('Error', 'No se pudo capturar el boleto: ' + err.message);
    }
  };

  // Compartir Ticket: El texto y la imagen del boleto
  const handleShareTextAndImage = async () => {
    try {
      const isFechea = (sale.lotteryId || sale.lottery_id) === 'fechea';
      const linesText = lines.map(line => {
        const val = isFechea 
          ? formatFecheaDate(getFecheaPlayValue(line))
          : `#${formatLotteryNumber(sale.lotteryId || sale.lottery_id, line.numero)}`;
        return `${val} ➔ ${lottery?.priceLabel || 'NIO '}${parseFloat(line.monto || 0).toFixed(2)}`;
      }).join('\n');

      const text = `*${settings.businessName || 'ZENTRIC'}* 🎫\n` +
        `*Boleto Oficial de Lotería*\n\n` +
        `• *ID:* #${sale.id?.slice(-8).toUpperCase()}\n` +
        `• *Sorteo:* ${lottery?.name}\n` +
        `• *Fecha Sorteo:* ${formatDrawDate(sale.lines?.[0]?.fecha || sale.drawDate)}\n` +
        `• *Vendedor:* ${sale.sellerName || sale.seller_name || '—'}\n` +
        `• *Cliente:* ${sale.comprador || 'Sin cliente'}\n\n` +
        `*JUGADAS:*\n${linesText}\n\n` +
        `*TOTAL A PAGAR: ${lottery?.priceLabel || 'NIO '}${parseFloat(sale.monto).toFixed(2)}*\n\n` +
        `_Verifique su boleto con el vendedor. ¡Muchas gracias por jugar!_`;

      if (!ticketRef.current) {
        await Share.share({ message: text });
        return;
      }

      const uri = await captureRef(ticketRef, {
        format: 'jpg',
        quality: 0.95,
      });

      await Share.share({
        message: text,
        url: uri,
      });
    } catch (err) {
      Alert.alert('Error', 'No se pudo compartir el boleto: ' + err.message);
    }
  };

  const isDigital = currentTheme === 'digital';

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={{
          width: '95%',
          maxWidth: 380,
          backgroundColor: '#090d16',
          borderRadius: 16,
          padding: 16,
          alignItems: 'stretch',
        }}>
          {/* Header row with Title and Close X icon */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            {/* Theme switcher tabs like Web */}
            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 2 }}>
              <TouchableOpacity
                onPress={() => setCurrentTheme('digital')}
                style={{
                  backgroundColor: isDigital ? '#a855f7' : 'transparent',
                  borderRadius: 18,
                  paddingVertical: 4,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: isDigital ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '800' }}>Digital</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setCurrentTheme('thermal')}
                style={{
                  backgroundColor: !isDigital ? '#a855f7' : 'transparent',
                  borderRadius: 18,
                  paddingVertical: 4,
                  paddingHorizontal: 12,
                }}
              >
                <Text style={{ color: !isDigital ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' }}>Térmico</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
              <X size={20} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          </View>

          {/* Ticket Voucher Frame */}
          <View 
            ref={ticketRef}
            collapsable={false}
            style={{
              borderWidth: 2,
              borderColor: isDigital ? '#a855f7' : '#000000',
              borderRadius: isDigital ? 12 : 4,
              backgroundColor: isDigital ? '#0b0f19' : '#ffffff',
              padding: 18,
              alignItems: 'stretch',
            }}
          >
            {/* Title & Badge */}
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '900',
                color: isDigital ? '#c084fc' : '#000000',
                letterSpacing: 1,
                textTransform: 'uppercase',
                fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
              }}>
                {settings.businessName || 'RIFAS EL GATO'}
              </Text>
              <View style={{
                borderColor: isDigital ? 'rgba(168, 85, 247, 0.4)' : '#000000',
                borderWidth: 1.5,
                borderRadius: isDigital ? 20 : 4,
                paddingVertical: 3,
                paddingHorizontal: 14,
                marginTop: 6,
              }}>
                <Text style={{
                  fontSize: 9,
                  color: isDigital ? '#c084fc' : '#000000',
                  fontWeight: '950',
                  letterSpacing: 0.5,
                  fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
                }}>
                  COMPROBANTE OFICIAL
                </Text>
              </View>
              <Text style={{
                fontSize: 11,
                color: isDigital ? 'rgba(255,255,255,0.6)' : '#000000',
                fontWeight: '800',
                marginTop: 10,
                fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
              }}>
                Boleto: #{sale.id?.slice(-8).toUpperCase()}
              </Text>
            </View>

            {/* Info Box */}
            <View style={{
              backgroundColor: isDigital ? '#161d2f' : '#f3f4f6',
              borderRadius: isDigital ? 10 : 4,
              padding: 12,
              gap: 6,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, color: isDigital ? 'rgba(255,255,255,0.4)' : '#6b7280', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>Sorteo:</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDigital ? '#fff' : '#000', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>{lottery?.name} ({getDrawHoursText(sale)})</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, color: isDigital ? 'rgba(255,255,255,0.4)' : '#6b7280', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>Fecha Venta:</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDigital ? '#fff' : '#000', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>{dateStr} {timeStr}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, color: isDigital ? 'rgba(255,255,255,0.4)' : '#6b7280', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>Fecha Sorteo:</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDigital ? '#fff' : '#000', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>{formatDrawDate(sale.lines?.[0]?.fecha || sale.drawDate)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, color: isDigital ? 'rgba(255,255,255,0.4)' : '#6b7280', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>Vendedor:</Text>
                <Text style={{ fontSize: 11, fontWeight: '800', color: isDigital ? '#fff' : '#000', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>{sale.sellerName || sale.seller_name || 'Vendedor'}</Text>
              </View>
            </View>

            {/* Dashed Line Divider */}
            <View style={{
              height: 1,
              borderWidth: 1,
              borderColor: isDigital ? 'rgba(255, 255, 255, 0.15)' : '#000000',
              borderStyle: 'dashed',
              marginVertical: 14,
            }} />

            {/* Conditional Plays rendering: Table or Range */}
            {lines.length > 5 ? (() => {
              const unitM = parseFloat(lines[0]?.monto || 0);
              const winM = unitM * payoutMultiplier;
              const cleanLotteryId = sale.lotteryId || sale.lottery_id;
              let missingNums = [];
              
              let rangeTxt = '';
              if (cleanLotteryId === 'fechea') {
                rangeTxt = `${lines.length} Fechas`;
              } else {
                const nums = lines.map(l => parseInt(l.numero, 10)).filter(n => !isNaN(n)).sort((a,b)=>a-b);
                if (nums.length > 0) {
                  const minNum = nums[0];
                  const maxNum = nums[nums.length - 1];
                  rangeTxt = `De ${formatLotteryNumber(cleanLotteryId, minNum)} a ${formatLotteryNumber(cleanLotteryId, maxNum)}`;
                  
                  for (let i = minNum; i <= maxNum; i++) {
                    if (!nums.includes(i)) {
                      missingNums.push(formatLotteryNumber(cleanLotteryId, i));
                    }
                  }
                } else {
                  rangeTxt = `${lines.length} números`;
                }
              }

              return (
                <View style={{
                  borderWidth: 1,
                  borderColor: isDigital ? 'rgba(168, 85, 247, 0.3)' : '#000000',
                  borderRadius: isDigital ? 12 : 4,
                  backgroundColor: isDigital ? 'rgba(168, 85, 247, 0.04)' : '#ffffff',
                  padding: 16,
                  marginBottom: 10,
                  alignItems: 'center',
                }}>
                  <Text style={{
                    fontSize: 9,
                    fontWeight: '900',
                    color: isDigital ? 'rgba(255,255,255,0.4)' : '#6b7280',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
                  }}>
                    SERIE / RANGO ADQUIRIDO
                  </Text>
                  
                  <Text style={{
                    fontSize: 24,
                    fontWeight: '950',
                    color: isDigital ? '#fbbf24' : '#000000',
                    marginVertical: 10,
                    fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
                  }}>
                    {rangeTxt}
                  </Text>

                  <View style={{
                    height: 1,
                    width: '100%',
                    backgroundColor: isDigital ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
                    marginVertical: 10,
                  }} />

                  <View style={{ width: '100%', gap: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: isDigital ? 'rgba(255,255,255,0.5)' : '#6b7280', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>Total Números:</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: isDigital ? '#fff' : '#000000', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>{lines.length} jugadas</Text>
                    </View>
                    {missingNums.length > 0 && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 11, color: COLORS.dangerLight, fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'), fontWeight: '750' }}>Omitidos (Cerrados):</Text>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.dangerLight, fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>{missingNums.map(n => `#${n}`).join(', ')}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: isDigital ? 'rgba(255,255,255,0.5)' : '#6b7280', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>Inv. por Número:</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: isDigital ? '#fff' : '#000000', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>{lottery?.priceLabel || 'NIO '}{unitM.toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: isDigital ? 'rgba(255,255,255,0.5)' : '#6b7280', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>Premio por Ganador:</Text>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: isDigital ? '#34d399' : '#000000', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>{lottery?.priceLabel || 'NIO '}{winM.toFixed(2)}</Text>
                    </View>
                  </View>

                  <Text style={{
                    fontSize: 8.5,
                    fontStyle: 'italic',
                    color: isDigital ? 'rgba(255,255,255,0.3)' : '#6b7280',
                    marginTop: 12,
                    textAlign: 'center',
                    fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
                  }}>
                    * Válido para toda la serie en el rango especificado
                  </Text>
                </View>
              );
            })() : (
              <View>
                {/* Table Plays Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 6 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: isDigital ? 'rgba(255,255,255,0.4)' : '#6b7280', flex: 2, fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>N° / FECHA</Text>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: isDigital ? 'rgba(255,255,255,0.4)' : '#6b7280', flex: 1.5, textAlign: 'center', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>INVERSIÓN</Text>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: isDigital ? 'rgba(255,255,255,0.4)' : '#6b7280', flex: 1.5, textAlign: 'right', fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace') }}>PREMIO</Text>
                </View>

                {/* Play rows */}
                <ScrollView style={{ maxHeight: 150 }}>
                  <View style={{ gap: 8 }}>
                    {lines.map((line, idx) => {
                      const val = (sale.lotteryId || sale.lottery_id) === 'fechea'
                        ? formatFecheaDate(getFecheaPlayValue(line))
                        : `#${formatLotteryNumber(sale.lotteryId || sale.lottery_id, line.numero)}`;
                      
                      const lineMonto = parseFloat(line.monto || 0);
                      const linePremio = lineMonto * payoutMultiplier;

                      return (
                        <View key={line.id ?? idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
                          {/* Number */}
                          <Text style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isDigital ? '#fbbf24' : '#000000',
                            flex: 2,
                            fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
                          }}>{val}</Text>
                          {/* Inversion */}
                          <Text style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: isDigital ? '#fff' : '#000000',
                            flex: 1.5,
                            textAlign: 'center',
                            fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
                          }}>
                            {lottery?.priceLabel || 'NIO'}{lineMonto.toFixed(2)}
                          </Text>
                          {/* Premio */}
                          <Text style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isDigital ? '#34d399' : '#000000',
                            flex: 1.5,
                            textAlign: 'right',
                            fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
                          }}>
                            {lottery?.priceLabel || 'NIO'}{linePremio.toFixed(2)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* Dashed Line Divider */}
            <View style={{
              height: 1,
              borderWidth: 1,
              borderColor: isDigital ? 'rgba(255, 255, 255, 0.15)' : '#000000',
              borderStyle: 'dashed',
              marginVertical: 14,
            }} />

            {/* Total Invertido Box */}
            <View style={{
              backgroundColor: isDigital ? '#161d2f' : '#f3f4f6',
              borderRadius: isDigital ? 10 : 4,
              paddingVertical: 12,
              paddingHorizontal: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Text style={{
                fontSize: 11,
                fontWeight: '800',
                color: isDigital ? 'rgba(255,255,255,0.7)' : '#000000',
                textTransform: 'uppercase',
                fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
              }}>
                TOTAL INVERTIDO:
              </Text>
              <Text style={{
                fontSize: 13,
                fontWeight: '900',
                color: isDigital ? '#34d399' : '#000000',
                fontFamily: isDigital ? undefined : (Platform.OS === 'ios' ? 'Courier' : 'monospace'),
              }}>
                {lottery?.priceLabel || 'NIO'}{parseFloat(sale.monto || 0).toFixed(2)}
              </Text>
            </View>

            {/* QR Code */}
            <View style={{ alignItems: 'center', marginTop: 14 }}>
              <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 8, borderWidth: isDigital ? 0 : 1, borderColor: '#e5e7eb' }}>
                <Image
                  source={{ uri: qrCodeUrl }}
                  style={{ width: 110, height: 110 }}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>

          {/* Action buttons under voucher */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {/* WhatsApp (Green) */}
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#22c55e',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
              onPress={handleShareImageOnly}
            >
              <Share2 size={15} color="#fff" />
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>
                WhatsApp
              </Text>
            </TouchableOpacity>

            {/* Compartir Ticket (Purple) */}
            <TouchableOpacity
              style={{
                flex: 1.2,
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#8b5cf6',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
              }}
              onPress={handleShareTextAndImage}
            >
              <Share2 size={15} color="#fff" />
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>
                Compartir Ticket
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
