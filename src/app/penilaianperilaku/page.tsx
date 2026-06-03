'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';
import ReviewCard from './ReviewCard';

interface Assignment {
  id: string;
  assessor_id: string;
  assessed_id: string;
  period_semester: number;
  period_year: number;
  is_completed: boolean;

  assessed?: {
    id: string;
    full_name: string;
    position: string;
  };
}

export default function PeerReviewPage() {

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {

    try {

      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('peer_review_assignments')
        .select('*')
        .eq('assessor_id', user.id)
        .eq('is_completed', false);

      if (error) throw error;

      if (!data || data.length === 0) {
        setAssignments([]);
        return;
      }

      const assessedIds = data.map(
        (item) => item.assessed_id
      );

      const {
        data: profiles
      } = await supabase
        .from('profiles')
        .select('id, full_name, position')
        .in('id', assessedIds);

      const merged = data.map((item) => ({
        ...item,
        assessed: profiles?.find(
          (p) => p.id === item.assessed_id
        )
      }));

      setAssignments(merged);

    } catch (err: any) {

      toast.error(err.message);

    } finally {

      setLoading(false);

    }
  }

  if (loading) {
    return (
      <div className="p-6">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">

      <h1 className="text-2xl font-bold mb-6">
        Penilaian Rekan Kerja
      </h1>

      {assignments.length === 0 && (
        <div className="bg-green-50 border rounded-lg p-4">
          Tidak ada penilaian yang harus diisi.
        </div>
      )}

      {assignments.map((item) => (

        <ReviewCard
          key={item.id}
          assignment={item}
          onSuccess={loadAssignments}
        />

      ))}

    </div>
  );
}