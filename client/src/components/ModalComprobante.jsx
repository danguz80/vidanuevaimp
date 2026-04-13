import React, { useState, useEffect } from "react";
import { X, Receipt } from "lucide-react";

const API = import.meta.env.VITE_BACKEND_URL;

const CONCEPTO_LABELS = {
  cuotas_diezmos: "Cuotas / Diezmos",
  otros: "Otros",
};

const TIPO_PAGO_LABELS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia online",
  deposito: "Depósito en banco",
};

const MENSAJE_DEFECTO = (concepto, nombreMiembro) =>
  `Estimado/a ${nombreMiembro},\n\nLa iglesia Misión Pentecostés Templo Vida Nueva, a través de su Tesorera, nuestra hna. Priscilla Vásquez Núñez, acredita que Ud. ha realizado un aporte en dinero por concepto de ${CONCEPTO_LABELS[concepto] || concepto}.\n\nSu donación es bien recibida y se agradece profundamente su cooperación. Que Dios le bendiga grandemente.\n\n"El que siembra escasamente, también segará escasamente; y el que siembra generosamente, generosamente también segará." — 2 Corintios 9:6`;

const FMT = (n) =>
  `$${Math.round(parseFloat(n || 0)).toLocaleString("es-CL")}`;

export default function ModalComprobante({ onClose, onEnviado, getToken }) {
  const [miembros, setMiembros] = useState([]);
  const [form, setForm] = useState({
    miembro_id: "",
    monto: "",
    concepto: "cuotas_diezmos",
    tipo_pago: "efectivo",
    fecha: new Date().toISOString().split("T")[0],
    mensaje: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Cargar lista de miembros activos
  useEffect(() => {
    fetch(`${API}/api/miembros`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setMiembros(data.filter((m) => m.estado === "activo"));
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line

  // Auto-generar mensaje cuando cambia miembro o concepto
  useEffect(() => {
    if (!form.miembro_id) return;
    const m = miembros.find((m) => String(m.id) === String(form.miembro_id));
    if (!m) return;
    setForm((p) => ({
      ...p,
      mensaje: MENSAJE_DEFECTO(p.concepto, `${m.nombre} ${m.apellido}`),
    }));
  }, [form.miembro_id, form.concepto, miembros]);

  const set = (campo, valor) => setForm((p) => ({ ...p, [campo]: valor }));

  const enviar = async () => {
    if (!form.miembro_id) { setError("Selecciona un miembro"); return; }
    if (!form.monto || isNaN(form.monto) || parseFloat(form.monto) <= 0) { setError("Ingresa un monto válido"); return; }
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/tesoreria/comprobantes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error al crear comprobante");
      const nuevo = await res.json();
      onEnviado?.(nuevo);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Receipt size={20} className="text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-800">Generar comprobante digital</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Miembro */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Miembro *</label>
            <select
              value={form.miembro_id}
              onChange={(e) => set("miembro_id", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="">Seleccionar miembro...</option>
              {miembros
                .sort((a, b) => a.apellido.localeCompare(b.apellido))
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.apellido}, {m.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Concepto */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Concepto *</label>
              <select
                value={form.concepto}
                onChange={(e) => set("concepto", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="cuotas_diezmos">Cuotas / Diezmos</option>
                <option value="otros">Otros</option>
              </select>
            </div>

            {/* Tipo de pago */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Tipo de pago *</label>
              <select
                value={form.tipo_pago}
                onChange={(e) => set("tipo_pago", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia online</option>
                <option value="deposito">Depósito en banco</option>
              </select>
            </div>

            {/* Monto */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Monto (CLP) *</label>
              <input
                type="number"
                min="1"
                value={form.monto}
                onChange={(e) => set("monto", e.target.value)}
                placeholder="Ej: 50000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Fecha */}
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Fecha *</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => set("fecha", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          {/* Mensaje */}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Mensaje al miembro{" "}
              <span className="text-gray-400 font-normal">(editable)</span>
            </label>
            <textarea
              rows={7}
              value={form.mensaje}
              onChange={(e) => set("mensaje", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none leading-relaxed"
            />
          </div>

          {/* Preview monto */}
          {form.monto && !isNaN(form.monto) && parseFloat(form.monto) > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800">
              <span className="font-semibold">Monto a acreditar: </span>
              {FMT(form.monto)}
              {" · "}
              {TIPO_PAGO_LABELS[form.tipo_pago]}
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 font-medium">✗ {error}</p>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={enviar}
              disabled={guardando}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {guardando ? "Enviando..." : "Enviar comprobante"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
