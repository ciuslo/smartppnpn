'use client';

import { useState } from 'react';

export default function ReviewCard({
  item,
  onSubmit
}: any) {

  const [form, setForm] = useState({
    integritas: 3,
    profesionalisme: 3,
    sinergi: 3,
    pelayanan: 3,
    komitmen_kerja: 3,
    notes: ''
  });

  function handleChange(
    field: string,
    value: any
  ) {

    setForm({
      ...form,
      [field]: value
    });
  }

  return (
    <div className="border rounded-xl p-4 mb-6">

      <h2 className="font-bold text-lg mb-4">
        {item.assessed.full_name}
      </h2>

      {[
        ['integritas', 'Integritas'],
        ['profesionalisme', 'Profesionalisme'],
        ['sinergi', 'Sinergi'],
        ['pelayanan', 'Pelayanan'],
        ['komitmen_kerja', 'Komitmen Kerja']
      ].map(([key, label]) => (

        <div
          key={key}
          className="mb-4"
        >

          <label className="block mb-2">
            {label}
          </label>

          <select
            className="border p-2 rounded w-full"
            value={(form as any)[key]}
            onChange={(e) =>
              handleChange(
                key,
                Number(e.target.value)
              )
            }
          >
            <option value="1">
              Kurang
            </option>

            <option value="2">
              Cukup
            </option>

            <option value="3">
              Baik
            </option>

            <option value="4">
              Sangat Baik
            </option>
          </select>

        </div>
      ))}

      <textarea
        className="border rounded p-2 w-full mb-4"
        placeholder="Catatan"
        value={form.notes}
        onChange={(e) =>
          handleChange(
            'notes',
            e.target.value
          )
        }
      />

      <button
        onClick={() =>
          onSubmit(
            item.id,
            item.assessed_id,
            form
          )
        }
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Simpan Penilaian
      </button>

    </div>
  );
}