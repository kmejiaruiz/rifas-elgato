// ============================================================
// HeaderClock — Reloj digital en formato de 12 horas (AM/PM)
// ============================================================
import React, { useState, useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';

export const HeaderClock = ({ style }) => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // Si es 0, representar como 12
      setTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Text style={[styles.clockText, style]}>{time}</Text>
  );
};

const styles = StyleSheet.create({
  clockText: {
    fontSize: 12,
    color: '#a78bfa', // primaryLight / violet
    fontWeight: '700',
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderColor: 'rgba(124, 58, 237, 0.2)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
});
