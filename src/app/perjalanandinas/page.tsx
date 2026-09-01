'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  MapPin,
  CheckCircle,
  History as HistoryIcon,
  ExternalLink,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'react-hot-toast';

type Stage = 'START' | 'CLOCK IN' | 'CLOCK OUT' | 'END';

const STAGES: Stage[] = ['START', 'CLOCK IN', 'CLOCK OUT', 'END'];

interface TripData {
  start_photo_url?: string;
  start_at?: string;
  start_latitude?: number;
  start_longitude?: number;
  clock_in_photo_url?: string;
  clock_in_at?: string;
  clock_in_latitude?: number;
  clock_in_longitude?: number;
  clock_out_photo_url?: string;
  clock_out_at?: string;
  clock_out_latitude?: number;
  clock_out_longitude?: number;
  end_photo_url?: string;
  end_at?: string;
  end_latitude?: number;
  end_longitude?: number;
}

// HELPER: Konversi Base64 ke Blob secara langsung & stabil di HP/Vercel
const base64ToBlob = (base64Data: string): Blob => {
  const parts = base64Data.split(';base64,');
  const contentType = parts[0].split(':')[1] || 'image/jpeg';
  const raw = window.atob(parts[1]);
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
};

export default function PerjalananDinasPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState('');
  const [currentStage, setCurrentStage] = useState<Stage>('START');

  // STATE TRIP UNTUK MENYIMPAN RIWAYAT FOTO & LOKASI
  const [trip, setTrip] = useState<TripData | null>(null);

  // STATE RIWAYAT & DROPDOWN COLLAPSIBLE
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [location, setLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);

  const [address, setAddress] = useState('Mencari lokasi...');
  const [photo, setPhoto] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tripId, setTripId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{
    title: string;
    url: string;
    date?: string;
    coord?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchHistory = async (uid: string) => {
    const { data, error } = await supabase
      .from('business_trip_attendances')
      .select('id, trip_date, destination, purpose, status, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setHistoryList(data);
    }
  };

  // =====================================
  // USER LOGIN
  // =====================================
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Anda belum login.');
        router.push('/login');
        return;
      }

      setUserId(user.id);
      fetchHistory(user.id);
    };

    getUser();
  }, [router]);

  // =====================================
  // CLEANUP CAMERA
  // =====================================
  useEffect(() => {
    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;

        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  // =====================================
  // GPS
  // =====================================
  const fetchLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation tidak didukung browser.');
      return;
    }

    setAddress('Mengambil lokasi...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        setLocation({
          lat,
          lon,
        });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
          );

          const data = await res.json();

          setAddress(data.display_name || 'Alamat tidak ditemukan');
        } catch {
          setAddress('Alamat tidak dapat ditemukan');
        }
      },
      () => {
        toast.error('Gagal mendapatkan lokasi.');
        setAddress('Lokasi tidak tersedia');
      }
    );
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  // =====================================
  // CAMERA
  // =====================================
  const openCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error('Browser tidak mendukung akses kamera.');
        return;
      }

      if (videoRef.current?.srcObject) {
        const oldStream = videoRef.current.srcObject as MediaStream;

        oldStream.getTracks().forEach((track) => {
          track.stop();
        });

        videoRef.current.srcObject = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setCameraOpen(true);

      setTimeout(async () => {
        if (!videoRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          toast.error('Preview kamera tidak ditemukan.');
          return;
        }

        videoRef.current.srcObject = stream;

        try {
          await videoRef.current.play();
        } catch (err) {
          console.error('Video play error:', err);
        }
      }, 100);
    } catch (error: any) {
      console.error('Camera error:', error);

      if (error?.name === 'NotAllowedError') {
        toast.error('Akses kamera ditolak.');
      } else if (error?.name === 'NotFoundError') {
        toast.error('Kamera tidak ditemukan.');
      } else if (error?.name === 'NotReadableError') {
        toast.error('Kamera sedang digunakan aplikasi lain.');
      } else {
        toast.error('Kamera tidak dapat dibuka.');
      }
    }
  };

  // =====================================
  // CAPTURE PHOTO
  // =====================================
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const width = 540;
    const height = 720;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);

    // WATERMARK
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, height - 170, width, 170);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('SMART PPNPN', 20, height - 130);

    ctx.font = '20px Arial';
    ctx.fillText(new Date().toLocaleString('id-ID'), 20, height - 95);

    if (location) {
      ctx.fillText(
        `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`,
        20,
        height - 60
      );
    }

    ctx.fillText(address.substring(0, 45), 20, height - 25);

    const image = canvas.toDataURL('image/jpeg', 0.7);

    setPhoto(image);
    setCameraOpen(false);

    const stream = video.srcObject as MediaStream;
    stream?.getTracks().forEach((track) => {
      track.stop();
    });
  };

  // =====================================
  // START PERJALANAN
  // =====================================
  const handleStart = async () => {
    if (!userId) {
      return toast.error('User belum ditemukan. Silakan login ulang.');
    }

    if (!destination.trim()) {
      return toast.error('Masukkan tujuan perjalanan.');
    }

    if (!purpose.trim()) {
      return toast.error('Masukkan keperluan perjalanan.');
    }

    if (!location) {
      return toast.error('Lokasi belum tersedia.');
    }

    if (!photo) {
      return toast.error('Silakan ambil foto terlebih dahulu.');
    }

    setIsSubmitting(true);

    try {
      const blob = base64ToBlob(photo);
      const fileName = `${userId}_start_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('business-trip-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload storage gagal: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('business-trip-photos')
        .getPublicUrl(fileName);

      const photoUrl = publicUrlData.publicUrl;
      const now = new Date().toISOString();

      const { data, error: dbError } = await supabase
        .from('business_trip_attendances')
        .insert({
          user_id: userId,
          trip_date: now.split('T')[0],
          destination: destination,
          purpose: purpose,
          start_at: now,
          start_latitude: location.lat,
          start_longitude: location.lon,
          start_address: address,
          start_photo_url: photoUrl,
          status: 'ongoing',
        })
        .select('id')
        .single();

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      setTripId(data.id);

      setTrip({
        start_at: now,
        start_latitude: location.lat,
        start_longitude: location.lon,
        start_photo_url: photoUrl,
      });

      setCurrentStage('CLOCK IN');
      setPhoto(null);

      toast.success('START perjalanan berhasil.');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Gagal memulai perjalanan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // =====================================
  // STAGE BERIKUTNYA
  // =====================================
  const handleNextStage = async () => {
    if (!tripId) {
      return toast.error('Data perjalanan tidak ditemukan.');
    }

    if (!location) {
      return toast.error('Lokasi belum tersedia.');
    }

    if (!photo) {
      return toast.error('Silakan ambil foto terlebih dahulu.');
    }

    setIsSubmitting(true);

    try {
      const blob = base64ToBlob(photo);
      const stageKey = currentStage.toLowerCase().replace(' ', '_');
      const fileName = `${userId}_${stageKey}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('business-trip-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload storage gagal: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('business-trip-photos')
        .getPublicUrl(fileName);

      const photoUrl = publicUrlData.publicUrl;
      const now = new Date().toISOString();

      if (currentStage === 'CLOCK IN') {
        const { error } = await supabase
          .from('business_trip_attendances')
          .update({
            clock_in_at: now,
            clock_in_latitude: location.lat,
            clock_in_longitude: location.lon,
            clock_in_photo_url: photoUrl,
          })
          .eq('id', tripId);

        if (error) throw new Error(error.message);

        setTrip((prev) => ({
          ...prev,
          clock_in_at: now,
          clock_in_latitude: location.lat,
          clock_in_longitude: location.lon,
          clock_in_photo_url: photoUrl,
        }));

        setCurrentStage('CLOCK OUT');
      } else if (currentStage === 'CLOCK OUT') {
        const { error } = await supabase
          .from('business_trip_attendances')
          .update({
            clock_out_at: now,
            clock_out_latitude: location.lat,
            clock_out_longitude: location.lon,
            clock_out_photo_url: photoUrl,
          })
          .eq('id', tripId);

        if (error) throw new Error(error.message);

        setTrip((prev) => ({
          ...prev,
          clock_out_at: now,
          clock_out_latitude: location.lat,
          clock_out_longitude: location.lon,
          clock_out_photo_url: photoUrl,
        }));

        setCurrentStage('END');
      } else if (currentStage === 'END') {
        const { error } = await supabase
          .from('business_trip_attendances')
          .update({
            end_at: now,
            end_latitude: location.lat,
            end_longitude: location.lon,
            end_photo_url: photoUrl,
            status: 'completed',
            updated_at: now,
          })
          .eq('id', tripId);

        if (error) throw new Error(error.message);

        setTrip((prev) => ({
          ...prev,
          end_at: now,
          end_latitude: location.lat,
          end_longitude: location.lon,
          end_photo_url: photoUrl,
        }));

        toast.success('Perjalanan dinas selesai.');
        router.push('/dashboard');
        return;
      }

      setPhoto(null);
      toast.success(`${currentStage} berhasil.`);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Gagal menyimpan presensi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getButtonText = () => {
    if (currentStage === 'START') return 'START PERJALANAN';
    if (currentStage === 'CLOCK IN') return 'CLOCK IN DI TUJUAN';
    if (currentStage === 'CLOCK OUT') return 'CLOCK OUT';
    return 'END PERJALANAN';
  };

  const handleSubmit = () => {
    if (currentStage === 'START') {
      handleStart();
    } else {
      handleNextStage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="bg-blue-900 text-white p-4 flex items-center">
        <button onClick={() => router.back()} className="mr-4">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Perjalanan Dinas</h1>
      </header>

      <main className="p-6 max-w-2xl mx-auto">
        {/* KARTU RIWAYAT PERJALANAN DINAS (COLLAPSIBLE) */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
          {/* Header Tombol Dropdown */}
          <button
            type="button"
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="w-full flex items-center justify-between border-b border-gray-100 pb-3 text-left focus:outline-none cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-bold text-gray-800">
                Riwayat Perjalanan Dinas
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                Total: {historyList.length}
              </span>
              {isHistoryOpen ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )}
            </div>
          </button>

          {/* Isi List Riwayat */}
          {isHistoryOpen && (
            <div className="mt-4 space-y-3">
              {historyList.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Belum ada riwayat perjalanan.
                </p>
              ) : (
                historyList.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 border border-gray-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                            item.status === 'completed' ||
                            item.status === 'SELESAI' ||
                            item.status === 'Selesai'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {item.status === 'completed' ||
                          item.status === 'SELESAI' ||
                          item.status === 'Selesai'
                            ? 'Selesai'
                            : 'Berjalan'}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {item.trip_date
                            ? new Date(item.trip_date).toLocaleDateString(
                                'id-ID',
                                {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                }
                              )
                            : '-'}
                        </span>
                      </div>

                      <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5 mt-1">
                        <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                        {item.destination || 'Tujuan tidak diisi'}
                      </h4>

                      <p className="text-xs text-gray-600 line-clamp-1 pl-5">
                        {item.purpose || 'Keperluan tidak diisi'}
                      </p>
                    </div>

                    <div className="flex items-center justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                      <a
                        href={`/verifikasi/perjalanan-dinas/${item.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                      >
                        <ExternalLink size={14} />
                        Lihat Dokumen
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* INFORMASI PERJALANAN */}
        {currentStage === 'START' && (
          <div className="bg-white p-5 rounded-xl shadow mb-5">
            <h2 className="font-bold text-lg mb-4">Informasi Perjalanan</h2>

            <label className="font-semibold text-sm">Tujuan</label>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Contoh: Banda Aceh"
              className="w-full border border-gray-300 rounded-lg p-3 mt-1 mb-4 text-sm"
            />

            <label className="font-semibold text-sm">Keperluan</label>
            <textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Keperluan perjalanan dinas"
              className="w-full border border-gray-300 rounded-lg p-3 mt-1 text-sm"
              rows={4}
            />
          </div>
        )}

        {/* STATUS PERJALANAN */}
        <div className="bg-white p-6 rounded-xl shadow mb-5">
          <h2 className="font-bold text-gray-800 mb-5 flex items-center justify-between">
            <span>Status Perjalanan</span>
            <span className="text-xs font-normal text-gray-500">
              Klik foto untuk memperbesar
            </span>
          </h2>

          {/* TIMELINE STEPPER */}
          <div className="relative pl-6 border-l-2 border-blue-100 space-y-6 ml-2">
            {STAGES.map((stage, index) => {
              const currentIndex = STAGES.indexOf(currentStage);
              const isCompleted = index < currentIndex;
              const isActive = stage === currentStage;

              const stagePhotoMap: Record<
                string,
                { url?: string; time?: string; lat?: number; lng?: number }
              > = {
                START: {
                  url: trip?.start_photo_url,
                  time: trip?.start_at,
                  lat: trip?.start_latitude,
                  lng: trip?.start_longitude,
                },
                'CLOCK IN': {
                  url: trip?.clock_in_photo_url,
                  time: trip?.clock_in_at,
                  lat: trip?.clock_in_latitude,
                  lng: trip?.clock_in_longitude,
                },
                'CLOCK OUT': {
                  url: trip?.clock_out_photo_url,
                  time: trip?.clock_out_at,
                  lat: trip?.clock_out_latitude,
                  lng: trip?.clock_out_longitude,
                },
                END: {
                  url: trip?.end_photo_url,
                  time: trip?.end_at,
                  lat: trip?.end_latitude,
                  lng: trip?.end_longitude,
                },
              };

              const stageData = stagePhotoMap[stage];

              return (
                <div key={stage} className="relative group">
                  {/* IKON INDIKATOR TIMELINE */}
                  <div
                    className={`absolute -left-[31px] top-1 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-green-600 text-white shadow-sm'
                        : isActive
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse'
                        : 'bg-white border-2 border-gray-300 text-transparent'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-current" />
                    )}
                  </div>

                  {/* CARD TAHAPAN */}
                  <div
                    className={`p-3.5 rounded-lg border transition-all ${
                      isActive
                        ? 'bg-blue-50/50 border-blue-200'
                        : isCompleted
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-white border-gray-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className={`text-sm font-bold ${
                            isActive
                              ? 'text-blue-900'
                              : isCompleted
                              ? 'text-gray-800'
                              : 'text-gray-400'
                          }`}
                        >
                          {stage}
                        </span>

                        {/* WAKTU SUBMIT */}
                        {isCompleted && stageData?.time && (
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {new Date(stageData.time).toLocaleTimeString(
                              'id-ID',
                              { hour: '2-digit', minute: '2-digit' }
                            )}{' '}
                            WIB
                          </p>
                        )}
                      </div>

                      {/* THUMBNAIL FOTO */}
                      {isCompleted && stageData?.url ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewPhoto({
                              title: stage,
                              url: stageData.url!,
                              date: stageData.time
                                ? new Date(stageData.time).toLocaleString(
                                    'id-ID'
                                  )
                                : undefined,
                              coord:
                                stageData.lat && stageData.lng
                                  ? `${stageData.lat.toFixed(
                                      5
                                    )}, ${stageData.lng.toFixed(5)}`
                                  : undefined,
                            })
                          }
                          className="relative group/thumb overflow-hidden rounded-md border border-gray-300 w-12 h-12 shrink-0 hover:ring-2 hover:ring-blue-500 transition shadow-sm"
                          title="Klik untuk melihat foto presensi"
                        >
                          <img
                            src={stageData.url}
                            alt={stage}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition text-white text-[10px] font-medium">
                            Lihat
                          </div>
                        </button>
                      ) : isActive ? (
                        <span className="text-[11px] bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                          Tahap Aktif
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODAL PREVIEW FOTO */}
        {previewPhoto && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-sm w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="p-3 border-b flex justify-between items-center bg-gray-50">
                <h4 className="font-bold text-sm text-gray-800">
                  Foto Presensi: {previewPhoto.title}
                </h4>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="text-gray-400 hover:text-gray-700 font-bold px-2 py-0.5 rounded text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="relative bg-black">
                <img
                  src={previewPhoto.url}
                  alt={previewPhoto.title}
                  className="w-full h-64 object-cover"
                />
                <div className="absolute bottom-0 inset-x-0 bg-black/75 text-white p-2.5 text-xs">
                  <p className="font-bold text-blue-400">SMART PPNPN</p>
                  {previewPhoto.date && (
                    <p className="text-[11px] text-gray-200">
                      {previewPhoto.date}
                    </p>
                  )}
                  {previewPhoto.coord && (
                    <p className="text-[11px] text-gray-300">
                      {previewPhoto.coord}
                    </p>
                  )}
                </div>
              </div>
              <div className="p-2.5 text-right bg-gray-50">
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="px-4 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-black transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LOKASI */}
        <div className="bg-white p-5 rounded-xl shadow mb-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={20} />
            <h2 className="font-bold">Lokasi</h2>
          </div>

          <p className="text-sm text-gray-600">{address}</p>

          {location && (
            <p className="text-sm text-gray-500 mt-2">
              {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
            </p>
          )}

          <button
            onClick={fetchLocation}
            className="mt-3 bg-blue-900 text-white px-4 py-2 rounded-lg text-sm"
          >
            Ambil Ulang Lokasi
          </button>
        </div>

        {/* CAMERA */}
        <div className="bg-white p-5 rounded-xl shadow mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Camera size={20} />
            <h2 className="font-bold">Foto Presensi</h2>
          </div>

          {!photo && !cameraOpen && (
            <button
              onClick={openCamera}
              className="bg-green-600 text-white px-4 py-3 rounded-lg text-sm"
            >
              Buka Kamera
            </button>
          )}

          {cameraOpen && (
            <div>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                controls={false}
                className="w-full rounded-lg bg-black"
                style={{
                  width: '100%',
                  minHeight: '300px',
                  objectFit: 'cover',
                }}
              />
              <button
                onClick={capturePhoto}
                className="mt-3 bg-blue-900 text-white px-4 py-3 rounded-lg text-sm w-full"
              >
                Ambil Foto
              </button>
            </div>
          )}

          {photo && (
            <div>
              <img
                src={photo}
                alt="Preview"
                className="w-full rounded-lg"
              />

              <button
                onClick={() => {
                  setPhoto(null);
                  openCamera();
                }}
                className="mt-3 bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm"
              >
                Ambil Ulang
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* SUBMIT */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className={`w-full py-4 rounded-xl text-white font-bold transition ${
            isSubmitting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-900 hover:bg-blue-800'
          }`}
        >
          {isSubmitting ? 'Memproses...' : getButtonText()}
        </button>
      </main>
    </div>
  );
}
