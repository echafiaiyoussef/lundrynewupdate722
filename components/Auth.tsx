
import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Mail, Lock, User, Loader2, LogIn, UserPlus, Building } from 'lucide-react';

const generateUUID = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface AuthProps {
  onAuthSuccess: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [laundryName, setLaundryName] = useState('');
  const [saasPlan] = useState<'silver' | 'gold' | 'platinum'>('gold');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!laundryName.trim()) {
          throw new Error('يرجى إدخال اسم المغسلة');
        }
        
        const laundryId = generateUUID();
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 14); // 14-day trial

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: 'admin',
              laundry_id: laundryId,
              laundry_name: laundryName,
              saas_plan: saasPlan,
              saas_expiry: expiryDate.toISOString(),
              saas_status: 'active'
            },
          },
        });
        
        if (signUpError) throw signUpError;

        // Try to insert directly into profiles & laundries tables if columns are ready
        try {
          const userId = signUpData?.user?.id;
          if (userId) {
            // Create laundry shop
            await supabase.from('laundries').insert([{
              id: laundryId,
              name: laundryName,
              owner_id: userId,
              subscription_plan: saasPlan,
              subscription_expiry: expiryDate.toISOString()
            }]);

            // Update profile
            await supabase.from('profiles').upsert({
              id: userId,
              email,
              role: 'admin',
              full_name: fullName,
              laundry_id: laundryId,
              laundry_name: laundryName,
              saas_plan: saasPlan,
              saas_expiry: expiryDate.toISOString(),
              saas_status: 'active'
            });
          }
        } catch (dbErr) {
          console.warn("Background tables insert failed, relying on auth metadata fallback:", dbErr);
        }

        alert('تم إنشاء حساب المغسلة وتفعيل الباقة التجريبية بنجاح! يمكنك تسجيل الدخول الآن.');
        setIsSignUp(false);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ ما');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F6] p-4 md:p-8">
      <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 transition-all duration-300">
        <div className="bg-indigo-600 p-8 md:p-10 text-center text-white">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <Building size={32} />
          </div>
          <h1 className="text-2xl md:text-3xl font-black mb-2">مغسلة نظافة وعود السحابية</h1>
          <p className="text-indigo-100 font-medium text-sm md:text-base">منصة إدارة المغاسل المتعددة</p>
        </div>

        <div className="p-6 md:p-10">
          <div className="flex gap-4 mb-6 p-1.5 bg-slate-50 rounded-2xl border">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
                !isSignUp ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'
              }`}
            >
              تسجيل دخول
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${
                isSignUp ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'
              }`}
            >
              مغسلة جديدة
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <>
                <div className="relative">
                  <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="الاسم الكامل للمالك"
                    className="w-full pr-12 pl-4 py-4 bg-slate-50 border rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="relative">
                  <Building className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="اسم مغسلتك التجارية"
                    className="w-full pr-12 pl-4 py-4 bg-slate-50 border rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm"
                    value={laundryName}
                    onChange={(e) => setLaundryName(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                className="w-full pr-12 pl-4 py-4 bg-slate-50 border rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm text-right"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="relative">
              <Lock className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="password"
                placeholder="كلمة المرور"
                className="w-full pr-12 pl-4 py-4 bg-slate-50 border rounded-2xl outline-none font-bold focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm text-right"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg md:text-xl hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <>
                  {isSignUp ? <UserPlus size={22} /> : <LogIn size={22} />}
                  {isSignUp ? 'إنشاء حساب مغسلة' : 'دخول النظام'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
