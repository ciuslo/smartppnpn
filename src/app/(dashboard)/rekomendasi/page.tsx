'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast from 'react-hot-toast';

export default function RekomendasiPage() {

  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    const now = new Date();

    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const { data, error } = await supabase
      .from('peer_review_assignments')
      .select(`
        *
        )
      `)
      .eq('assessor_id', user.id)
      .eq('period_month', month)
      .eq('period_year', year)
      .eq('is_completed', false);

    if (!error) {
      setAssignments(data || []);
    }
  }

  async function submitReview(
    assignmentId: string,
    assessedId: string,
    form: any
  ) {

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) return;

    const now = new Date();

    const payload = {
      assignment_id: assignmentId,

      assessor_id: user.id,
      assessed_id: assessedId,

      period_month: now.getMonth() + 1,
      period_year: now.getFullYear(),

      ...form
    };

    const { error } = await supabase
      .from('peer_assessments')
      .insert(payload);

    if (error) {
      toast.error(error.message);
      return;
    }

    // update completed
    await supabase
      .from('peer_review_assignments')
      .update({
        is_completed: true
      })
      .eq('id', assignmentId);

    toast.success('Penilaian berhasil');

    loadAssignments();
  }

  return (
    <div className="p-4">

      <h1 className="text-2xl font-bold mb-6">
        Rekomendasi KI
      </h1>

     
    </div>
  );
}