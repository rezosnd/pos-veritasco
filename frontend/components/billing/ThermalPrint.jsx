'use client';

import { useEffect } from 'react';

export default function ThermalPrint({ restaurant, items, bill, tableNumber, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    const handleAfterPrint = () => onClose();
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [onClose]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="print-receipt hidden">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body > *:not(.print-receipt) { display: none !important; }
          .print-receipt { display: block !important; }
        }
      `}} />

      <div style={{ fontFamily: "'Courier New', monospace", fontSize: '12px', width: '80mm', color: '#000' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{restaurant?.name}</div>
          {restaurant?.address?.line1 && <div>{restaurant.address.line1}</div>}
          {restaurant?.address?.city && <div>{restaurant.address.city}</div>}
          {restaurant?.phone && <div>Ph: {restaurant.phone}</div>}
          {restaurant?.gst_number && <div>GSTIN: {restaurant.gst_number}</div>}
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>Table: {tableNumber}</span>
          <span>{dateStr} {timeStr}</span>
        </div>

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px' }}>
          <span>ITEM</span>
          <span>QTY</span>
          <span>AMT</span>
        </div>
        <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', margin: '3px 0', fontSize: '11px' }}>
            <span style={{ flex: 1, overflow: 'hidden' }}>{item.name.substring(0, 20)}</span>
            <span style={{ width: '25px', textAlign: 'center' }}>{item.quantity}</span>
            <span style={{ width: '50px', textAlign: 'right' }}>₹{(item.price * item.quantity).toFixed(0)}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>Subtotal</span><span>₹{bill?.subtotal?.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span>GST ({bill?.gstPercent}%)</span><span>₹{bill?.gst?.toFixed(2)}</span>
        </div>

        <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
          <span>TOTAL</span><span>₹{bill?.total?.toFixed(2)}</span>
        </div>
        <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

        {restaurant?.upi_id && (
          <div style={{ textAlign: 'center', fontSize: '10px', margin: '4px 0' }}>
            UPI: {restaurant.upi_id}
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: '11px', marginTop: '8px', fontWeight: 'bold' }}>
          Thank you for visiting!
        </div>
        <div style={{ textAlign: 'center', fontSize: '10px' }}>Please visit again</div>
      </div>
    </div>
  );
}
