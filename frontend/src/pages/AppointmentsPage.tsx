import React, { useEffect, useState } from "react";
import { Calendar, Clock, Plus, Trash2, X } from "lucide-react";
import { api } from "../api/client";
import { StatusBadge } from "../components/Badge";
import { formatISTTimeSlot, getTomorrowISTDate } from "../utils/format";
import type { Appointment } from "../types";

export function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tomorrow = getTomorrowISTDate();
  const [date, setDate] = useState(tomorrow);
  const [time, setTime] = useState("11:30");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [purpose, setPurpose] = useState("Product Demo & Consultation");

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const data = await api.getAppointments();
      setAppointments(data);
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async (d: string) => {
    try {
      const res = await api.getAvailableSlots(d);
      setAvailableSlots(res.available_slots);
      if (res.available_slots.length > 0 && !res.available_slots.includes(time)) {
        setTime(res.available_slots[0]);
      }
    } catch {
      setAvailableSlots(["10:00", "11:30", "14:00", "15:30", "17:00"]);
    }
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  useEffect(() => {
    if (modalOpen) {
      loadSlots(date);
    }
  }, [modalOpen, date]);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createAppointment({
        customer_name: customerName,
        customer_email: customerEmail || undefined,
        appointment_date: date,
        appointment_time: time,
        purpose,
      });
      setModalOpen(false);
      setCustomerName("");
      setCustomerEmail("");
      await loadAppointments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    await api.updateAppointment(id, { status });
    await loadAppointments();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Remove this appointment?")) return;
    await api.deleteAppointment(id);
    await loadAppointments();
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-bold text-slate-900">
            Appointment Schedule (IST • Asia/Kolkata)
          </h3>
          <p className="text-xs text-slate-500">
            Local DB scheduling in Indian Standard Time with double-booking protection.
          </p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-xs"
        >
          <Plus className="h-4 w-4" />
          Schedule Appointment
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3.5">Customer</th>
              <th className="px-4 py-3.5">Date & Time</th>
              <th className="px-4 py-3.5">Purpose</th>
              <th className="px-4 py-3.5">Provider</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading appointments...
                </td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No appointments scheduled yet.
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-900">{a.customer_name}</p>
                    <p className="text-xs text-slate-500">{a.customer_email || "No email"}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 text-slate-800 font-medium tabular-nums">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      {a.appointment_date}
                      <Clock className="h-3.5 w-3.5 text-slate-400 ml-1" />
                      {formatISTTimeSlot(a.appointment_time)}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-slate-700">{a.purpose}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{a.calendar_provider}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge value={a.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-2">
                    <select
                      value={a.status}
                      onChange={(e) => handleStatusChange(a.id, e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer align-middle"
                      title="Delete Appointment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">Book Appointment</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {error && (
              <div className="mb-3 p-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</div>
            )}
            <form onSubmit={handleBook} className="space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-700">Customer Name *</label>
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Customer Email</label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-700">Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-700">Time *</label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">
                  Open standard IST slots on {date}:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableSlots.length === 0 ? (
                    <span className="text-xs text-amber-600">
                      All standard slots booked on this date
                    </span>
                  ) : (
                    availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setTime(slot)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                          time === slot
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {formatISTTimeSlot(slot)}
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">Meeting Purpose *</label>
                <input
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl cursor-pointer"
                >
                  Confirm Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
