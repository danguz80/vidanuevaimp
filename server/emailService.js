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
    const result = await client.query(
      `INSERT INTO donaciones (order_id, email, payer_name, amount_clp, amount_usd, fecha)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        donationData.orderId,
        donationData.email,
        donationData.payerName,
        donationData.amountCLP,
        donationData.amountUSD
      ]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
};
