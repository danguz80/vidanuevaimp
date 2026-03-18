import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Configurar transporter de nodemailer
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // Puedes cambiar a otro servicio
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD // Usa App Password de Gmail
    }
  });
};

// Generar PDF del comprobante
const generateReceiptPDF = (donationData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Diseño del PDF
    doc.fontSize(25).text('Comprobante de Donación', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(20).text('Iglesia Misión Pentecostés', { align: 'center' });
    doc.fontSize(16).text('Templo Vida Nueva', { align: 'center' });
    doc.moveDown(2);

    // Información de la donación
    doc.fontSize(12);
    doc.text(`Fecha: ${format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`);
    doc.moveDown();
    
    doc.text(`ID de Transacción: ${donationData.orderId}`);
    doc.moveDown();
    
    doc.fontSize(14);
    doc.text(`Monto donado: $${donationData.amountCLP.toLocaleString('es-CL')} CLP`, { bold: true });
    doc.fontSize(12);
    doc.text(`(Equivalente: USD $${donationData.amountUSD})`);
    doc.moveDown();
    
    if (donationData.email) {
      doc.text(`Email: ${donationData.email}`);
      doc.moveDown();
    }
    
    if (donationData.payerName) {
      doc.text(`Donante: ${donationData.payerName}`);
      doc.moveDown();
    }

    doc.moveDown(2);
    doc.fontSize(10);
    doc.text('¡Gracias por tu generosa donación!', { align: 'center' });
    doc.text('Tu apoyo nos ayuda a continuar nuestra misión.', { align: 'center' });
    doc.moveDown();
    doc.text('Que Dios te bendiga abundantemente.', { align: 'center', italics: true });
    
    doc.moveDown(3);
    doc.fontSize(8);
    doc.text('Este comprobante es válido como constancia de donación.', { align: 'center' });
    doc.text('Para consultas: contacto@vidanuevaimp.com', { align: 'center' });

    doc.end();
  });
};

// Enviar email con el comprobante
export const sendDonationReceipt = async (donationData) => {
  try {
    const transporter = createTransporter();
    const pdfBuffer = await generateReceiptPDF(donationData);

    const mailOptions = {
      from: `"Iglesia Vida Nueva" <${process.env.EMAIL_USER}>`,
      to: donationData.email,
      subject: '✨ Comprobante de tu Donación - Iglesia Vida Nueva',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">¡Gracias por tu generosa donación!</h2>
          
          <p>Estimado/a ${donationData.payerName || 'hermano/a'},</p>
          
          <p>Hemos recibido tu donación de <strong>$${donationData.amountCLP.toLocaleString('es-CL')} CLP</strong> 
          (USD $${donationData.amountUSD}).</p>
          
          <p>Tu apoyo es fundamental para continuar con nuestra misión de llevar el evangelio 
          y servir a nuestra comunidad.</p>
          
          <p>Adjunto encontrarás el comprobante oficial de tu donación.</p>
          
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>ID de Transacción:</strong> ${donationData.orderId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Fecha:</strong> ${format(new Date(), "dd 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}</p>
          </div>
          
          <p style="color: #059669; font-style: italic;">"Cada uno dé como propuso en su corazón: 
          no con tristeza, ni por necesidad, porque Dios ama al dador alegre." - 2 Corintios 9:7</p>
          
          <p>Que Dios te bendiga abundantemente,</p>
          <p><strong>Iglesia Misión Pentecostés - Templo Vida Nueva</strong></p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
          
          <p style="font-size: 12px; color: #6b7280;">
            Si tienes alguna pregunta, no dudes en contactarnos.<br>
            📧 contacto@vidanuevaimp.com<br>
            🌐 www.vidanuevaimp.com
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Comprobante_Donacion_${donationData.orderId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email enviado:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error al enviar email:', error);
    throw error;
  }
};

// Guardar donación en base de datos
export const saveDonation = async (pool, donationData) => {
  const client = await pool.connect();
  try {
    // Evitar duplicados: si el order_id ya existe, devolver el registro existente
    const existing = await client.query(
      'SELECT * FROM donaciones WHERE order_id = $1',
      [donationData.orderId]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    const result = await client.query(
      `INSERT INTO donaciones (order_id, email, payer_name, amount_clp, amount_usd, fondo_id, fecha, metodo_pago, estado)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'paypal', 'confirmado')
       RETURNING *`,
      [
        donationData.orderId,
        donationData.email,
        donationData.payerName,
        donationData.amountCLP,
        donationData.amountUSD,
        donationData.fondoId || 1
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────
// Generar PDF comprobante de donación en EFECTIVO
// ─────────────────────────────────────────────────────────────
const generateCashReceiptPDF = ({ orderId, payerName, amountCLP, fondoNombre, fecha }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 60 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const fechaStr = format(fecha || new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
    const horaStr = format(fecha || new Date(), 'HH:mm', { locale: es });

    // — Encabezado —
    doc.fontSize(18).font('Helvetica-Bold')
       .text('Iglesia Misión Pentecostés', { align: 'center' });
    doc.fontSize(16).font('Helvetica-Bold')
       .text('Templo Vida Nueva', { align: 'center' });
    doc.moveDown(0.5);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
    doc.moveDown(0.5);

    doc.fontSize(14).font('Helvetica-Bold')
       .text('Comprobante de Promesa de Donación en Efectivo', { align: 'center' });
    doc.moveDown(1.5);

    // — Datos —
    const startY = doc.y;
    const leftCol = 60;
    const rightCol = 200;

    const addRow = (label, value) => {
      doc.font('Helvetica-Bold').fontSize(11).text(label, leftCol, doc.y, { continued: true, width: 130 });
      doc.font('Helvetica').fontSize(11).text(value);
      doc.moveDown(0.6);
    };

    addRow('Nº Comprobante:', orderId);
    addRow('Fecha:', `${fechaStr} – ${horaStr}`);
    addRow('Donante:', payerName);
    addRow('Fondo:', fondoNombre);
    addRow('Monto comprometido:', `$${Number(amountCLP).toLocaleString('es-CL')} CLP`);
    addRow('Estado:', 'Pendiente de entrega en efectivo');

    doc.moveDown(1);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
    doc.moveDown(1);

    // — Aviso 7 días —
    doc.font('Helvetica-Bold').fontSize(11)
       .text('⚠ Importante:', { continued: true })
       .font('Helvetica').fontSize(11)
       .text(' El donante tiene 7 días corridos a partir de la fecha de emisión de este comprobante para entregar el efectivo al tesorero de la iglesia. Si no se realiza la entrega en ese plazo, la donación quedará automáticamente anulada.');
    doc.moveDown(2);

    // — Firmas —
    const sigY = doc.y;
    const col1X = 70;
    const col2X = 330;
    const lineW = 180;

    // Firma donante
    doc.font('Helvetica').fontSize(10).text(payerName, col1X, sigY + 5, { width: lineW, align: 'center' });
    doc.moveTo(col1X, sigY + 25).lineTo(col1X + lineW, sigY + 25).stroke();
    doc.font('Helvetica').fontSize(9).text('Firma del Donante', col1X, sigY + 30, { width: lineW, align: 'center' });

    // Firma tesorería
    doc.moveTo(col2X, sigY + 25).lineTo(col2X + lineW, sigY + 25).stroke();
    doc.font('Helvetica').fontSize(9)
       .text('Firma Tesorería', col2X, sigY + 30, { width: lineW, align: 'center' });
    doc.text('Iglesia Misión Pentecostés Templo Vida Nueva', col2X, sigY + 42, { width: lineW, align: 'center' });

    doc.moveDown(5);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).stroke();
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
       .text('Este documento es un comprobante de promesa de donación. Para consultas: vidanuevaimp@gmail.com', { align: 'center' });

    doc.end();
  });
};

// Enviar comprobante de donación en EFECTIVO a administración y al donante
export const sendCashDonationReceipt = async ({ orderId, payerName, amountCLP, fondoNombre, fecha, email }) => {
  const transporter = createTransporter();
  const pdfBuffer = await generateCashReceiptPDF({ orderId, payerName, amountCLP, fondoNombre, fecha });

  const fechaStr = format(fecha || new Date(), "dd 'de' MMMM 'de' yyyy", { locale: es });
  const recipients = ['pricivas@gmail.com', 'vidanuevaimp@gmail.com'];
  if (email) recipients.push(email);

  await transporter.sendMail({
    from: `"Iglesia Vida Nueva" <${process.env.EMAIL_USER}>`,
    to: recipients.join(', '),
    subject: `Comprobante Donación en Efectivo – ${payerName} – ${fechaStr}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1d4ed8;">Nueva promesa de donación en efectivo</h2>
        <p><strong>Donante:</strong> ${payerName}</p>
        <p><strong>Monto:</strong> $${Number(amountCLP).toLocaleString('es-CL')} CLP</p>
        <p><strong>Fondo:</strong> ${fondoNombre}</p>
        <p><strong>Fecha:</strong> ${fechaStr}</p>
        <p><strong>Nº comprobante:</strong> ${orderId}</p>
        <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:14px;margin:20px 0;">
          <strong>⚠ El donante tiene 7 días para entregar el efectivo a tesorería.</strong><br>
          Si no se realiza la entrega, la donación quedará anulada automáticamente.
        </div>
        <p>Se adjunta el comprobante oficial en PDF.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
        <p style="font-size:12px;color:#6b7280;">Iglesia Misión Pentecostés Templo Vida Nueva</p>
      </div>
    `,
    attachments: [
      {
        filename: `Comprobante_Efectivo_${orderId}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  });
};
