
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Package, 
  Wallet, 
  Search,
  ShoppingCart,
  CheckCircle,
  Clock,
  AlertTriangle,
  Printer,
  Share2,
  Trash2,
  X,
  Repeat,
  Loader2,
  TrendingUp,
  Plus,
  ArrowRight,
  ArrowLeft,
  Bell,
  Check,
  Database,
  ExternalLink,
  ChevronLeft,
  User,
  Phone,
  Layers,
  Banknote,
  Send,
  Download,
  Filter,
  Minus,
  Save,
  Edit3,
  Settings2,
  Menu,
  ShieldCheck,
  Zap,
  Gift,
  CreditCard,
  UserPlus,
  Edit2,
  FileSpreadsheet,
  FileText,
  Crown,
  Building2,
  Sparkles,
  Smile,
  ChevronDown,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { Order, InventoryItem, OrderType, OrderStatus, LaundryItem, PaymentMethod, TwilioConfig, UserProfile, UserRole, Subscription, Offer, SubscriptionPackage } from './types';
import { BarcodeGenerator } from './components/BarcodeGenerator';
import { Auth } from './components/Auth';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { generateSmartReminder, MessageContext } from './services/geminiService';
import { sendTwilioWhatsApp } from './services/twilioService';

// Ensure html2pdf is available via window
declare var html2pdf: any;

const ensureUUID = (str: string): string => {
  if (!str) return '00000000-0000-0000-0000-000000000000';
  
  // Check if it's already a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(str)) {
    return str.toLowerCase();
  }
  
  // Deterministically hash the string to a UUID format
  let hash1 = 0;
  let hash2 = 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash1 = (hash1 * 31 + ch) | 0;
    hash2 = (hash2 * 37 + ch) | 0;
  }
  
  const hex1 = Math.abs(hash1).toString(16).padStart(8, '0');
  const hex2 = Math.abs(hash2).toString(16).padStart(8, '0');
  const hex3 = Math.abs(hash1 ^ hash2).toString(16).padStart(8, '0');
  const hex4 = Math.abs(hash1 + hash2).toString(16).padStart(8, '0');
  
  const rawHex = (hex1 + hex2 + hex3 + hex4).substring(0, 32).padEnd(32, 'f');
  
  return `${rawHex.slice(0, 8)}-${rawHex.slice(8, 12)}-${rawHex.slice(12, 16)}-${rawHex.slice(16, 20)}-${rawHex.slice(20, 32)}`;
};

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if randomUUID fails (e.g. HTTP non-secure context)
    }
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c: number) =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      );
    } catch (e) {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');
  // Get the last 9 digits (which is standard for Saudi mobile numbers without country code or leading 0)
  return digits.slice(-9);
};

const INITIAL_ITEMS = [
  { name: 'ثوب', price: 5, icon: '👕' },
  { name: 'غترة/شماغ', price: 3, icon: '🧣' },
  { name: 'قميص', price: 4, icon: '👔' },
  { name: 'بنطلون', price: 4, icon: '👖' },
  { name: 'تيشرت', price: 3, icon: '👕' },
  { name: 'فستان', price: 15, icon: '👗' },
  { name: 'جاكيت', price: 10, icon: '🧥' },
  { name: 'بطانية', price: 25, icon: '🛌' },
  { name: 'سجادة', price: 30, icon: '🧶' },
  { name: 'بدلة كاملة', price: 15, icon: '🤵' },
  { name: 'ملاءة سرير', price: 10, icon: '🛏️' },
];

const PRESET_CUSTOM_ICONS = [
  '✨', '👕', '👔', '👗', '🥼', '🧥', '👖', '🥋', 
  '🧦', '🧣', '🧤', '🧢', '🎩', '🛏️', '🧺', '🧽', 
  '🧼', '🛋️', '👑', '🎒', '👟', '👠', '🧵', '🏷️', 
  '🧶', '👰', '🤵', '🥾', '👜', '🧳', '🧸', '🚿'
];

const PRESET_INVENTORY_ITEMS = [
  { name: 'شامبو عباية', stock: 300, unit: 'مل', threshold: 10 },
  { name: 'سائل مبيض كلور', stock: 300, unit: 'مل', threshold: 10 },
  { name: 'صودا سائل', stock: 300, unit: 'مل', threshold: 10 },
  { name: 'سائل فيري', stock: 300, unit: 'مل', threshold: 10 },
  { name: 'سائل كمفورت', stock: 300, unit: 'مل', threshold: 10 },
  { name: 'مسحوق الغسيل', stock: 750, unit: 'جرام', threshold: 15 },
  { name: 'صودا الغسيل (قشور)', stock: 250, unit: 'مل', threshold: 20 },
  { name: 'معطر رحاب', stock: 500, unit: 'مل', threshold: 90 },
  { name: 'علاقات الملابس', stock: 1, unit: 'حبة', threshold: 1 },
  { name: 'نشاء الكوي', stock: 500, unit: 'مل', threshold: 9 },
  { name: 'نيلة الملابس', stock: 10, unit: 'مل', threshold: 20 },
  { name: 'كيس الملابس الداخلية', stock: 1, unit: 'كيس', threshold: 12 },
  { name: 'رول ورق كاشير', stock: 1, unit: 'رول', threshold: 1 },
  { name: 'كرتون ورق الشماغ', stock: 1, unit: 'ورقة', threshold: 1 },
  { name: 'منعم ملابس', stock: 300, unit: 'مل', threshold: 10 },
  { name: 'ول بلاستيك ملابس طوي', stock: 1, unit: 'كيس', threshold: 1 },
  { name: 'ل بلاستيك ملابس قصي', stock: 1, unit: 'كيس', threshold: 1 },
];

const TAX_RATE = 0.15;

const DISCLAIMER_TEXT = "تنويه هام: المغسلة غير مسؤولة عن فقدان أي أغراض شخصية تُترك داخل الملابس عند استلامها، كما لا تتحمل مسؤولية حفظ الملابس أو الأغراض بعد مضي (15) يومًا من تاريخ الاستلام.";

const statusArabic: Record<OrderStatus, string> = {
  Received: 'تم الاستلام',
  Washing: 'جاري الغسيل',
  Ironing: 'جاري الكي',
  Ready: 'جاهز للاستلام',
  Delivered: 'تم التسليم',
};

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['dashboard', 'new-order', 'orders', 'inventory', 'finance', 'users', 'settings', 'subscriptions'],
  manager: ['dashboard', 'new-order', 'orders', 'inventory', 'finance', 'subscriptions'],
  staff: ['dashboard', 'new-order', 'orders'],
};

const navItems = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'new-order', label: 'كاشير جديد', icon: PlusCircle },
  { id: 'orders', label: 'الطلبات', icon: Package },
  { id: 'inventory', label: 'المخزون', icon: Layers },
  { id: 'finance', label: 'الحسابات', icon: Wallet },
  { id: 'subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { id: 'users', label: 'المستخدمين', icon: User },
  { id: 'settings', label: 'الإعدادات', icon: Settings2 },
];

const safeFormatDate = (dateVal: any, locale: string = 'ar-SA', fallback: string = '-'): string => {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 30);
      if (d > farFuture) {
        return 'لا محدود';
      }
      return d.toLocaleDateString(locale);
    }
  } catch (e) {}
  return fallback;
};

const safeFormatDateWithTime = (dateVal: any, locale: string = 'ar-SA', fallback: string = '-'): string => {
  if (!dateVal) return fallback;
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 30);
      if (d > farFuture) {
        return 'لا محدود';
      }
      return d.toLocaleString(locale);
    }
  } catch (e) {}
  return fallback;
};

const safeDateToInputVal = (dateVal: any): string => {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}
  return '';
};

const safeAddDaysISO = (daysToAdd: any): string => {
  const d = new Date();
  const days = typeof daysToAdd === 'number' ? daysToAdd : (parseInt(daysToAdd, 10) ?? 30);
  if (days === 0 || days >= 36500) {
    d.setFullYear(d.getFullYear() + 100);
    return d.toISOString();
  }
  d.setDate(d.getDate() + days);
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + 100);
    return fallback.toISOString();
  }
  return d.toISOString();
};

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isDbMultiTenant, setIsDbMultiTenant] = useState<boolean>(false);
  const [onboardingLaundryName, setOnboardingLaundryName] = useState('');
  const [onboardingPlan, setOnboardingPlan] = useState<'silver' | 'gold' | 'platinum'>('gold');
  const [showSaaSPaymentModal, setShowSaaSPaymentModal] = useState<boolean>(false);
  const [upgradePlanForm, setUpgradePlanForm] = useState<'silver' | 'gold' | 'platinum'>('gold');

  const [laundries, setLaundries] = useState<any[]>([]);
  const [newStaffForm, setNewStaffForm] = useState<{
    full_name: string;
    email: string;
    password: string;
    role: UserRole;
    laundry_id: string;
    laundry_name: string;
    permissions: string[];
  }>({
    full_name: '',
    email: '',
    password: '',
    role: 'staff',
    laundry_id: '',
    laundry_name: '',
    permissions: ['dashboard', 'new-order', 'orders']
  });
  const [createStaffLoading, setCreateStaffLoading] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);

  const [editingUserProfile, setEditingUserProfile] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingUserForm, setEditingUserForm] = useState<{
    full_name: string;
    role: UserRole;
    laundry_id: string;
    laundry_name: string;
    permissions: string[];
  }>({
    full_name: '',
    role: 'staff',
    laundry_id: '',
    laundry_name: '',
    permissions: []
  });

  const cleanTenantString = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
      .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\|/i, '')
      .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '')
      .replace(/^laund-[a-z0-9]+\|/, '')
      .replace(/^laund-[a-z0-9]+-/, '');
  };
  const [activeTab, setActiveTab] = useState<'dashboard' | 'new-order' | 'orders' | 'inventory' | 'finance' | 'users' | 'settings' | 'offers' | 'subscriptions'>('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscriptionPackages, setSubscriptionPackages] = useState<SubscriptionPackage[]>([
    { id: '1', name: 'الباقة الفضية', total_items: 30, price: 150, duration_days: 30 },
    { id: '2', name: 'الباقة الذهبية', total_items: 60, price: 280, duration_days: 30 },
    { id: '3', name: 'الباقة الماسية', total_items: 100, price: 450, duration_days: 30 },
  ]);
  const [offers, setOffers] = useState<Offer[]>([
    { id: '1', title: 'عرض الـ 100 قطعة', description: 'اغسل 100 قطعة واحصل على 5 قطع مجاناً', threshold_items: 100, free_items: 5 },
    { id: '2', title: 'خصم الافتتاح', description: 'خصم 10% على جميع الطلبات لفترة محدودة', discount_percent: 10 }
  ]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [twilioConfig, setTwilioConfig] = useState<TwilioConfig>({
    accountSid: '',
    authToken: '',
    fromNumber: '',
    enabled: false
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [customPrices, setCustomPrices] = useState<Record<string, any>>({});
  const [isCategoriesLoaded, setIsCategoriesLoaded] = useState(false);

  const syncCustomPricesToDb = async (newPrices: Record<string, any>) => {
    try {
      const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
      const key = isDbMultiTenant ? 'laundry_categories_custom_prices' : `${laundryId}_laundry_categories_custom_prices`;
      const payload: any = {
        key,
        value: newPrices,
        updated_at: new Date().toISOString()
      };
      if (isDbMultiTenant) {
        payload.laundry_id = laundryId;
      }

      const { error } = await supabase
        .from('settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) {
        console.error("Error syncing custom prices to Supabase settings:", error);
      } else {
        console.log("Successfully synced custom prices to Supabase settings!");
      }
    } catch (e) {
      console.error("Exception in syncCustomPricesToDb:", e);
    }
  };

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [inventoryConsumption, setInventoryConsumption] = useState<Record<string, Record<string, number>>>({});
  const [customItemConsumptions, setCustomItemConsumptions] = useState<Record<string, number>>({});
  const [editingConsumptionItem, setEditingConsumptionItem] = useState<any | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const getGroupedItems = (items: any[]) => {
    if (!items) return [];
    const groups: Record<string, { key: string; item: any; totalQty: number; totalPrice: number; originalItems: any[] }> = {};
    items.forEach(item => {
      const opts: string[] = [];
      if (item.service_type === 'مستعجل' || (item as any).is_urgent) opts.push('مستعجل');
      if (item.is_ironing_only) opts.push('كوي');
      if ((item as any).is_no_ironing || item.ironing_type === 'بدون كوي') opts.push('بدون كوي');
      if (opts.length === 0) opts.push('عادي');
      const optStr = opts.join('+');
      const key = `${item.name}_${optStr}`;
      
      if (!groups[key]) {
        groups[key] = {
          key,
          item: { ...item },
          totalQty: 0,
          totalPrice: 0,
          originalItems: []
        };
      }
      groups[key].totalQty += item.quantity || 1;
      groups[key].totalPrice += (item.price || 0) * (item.quantity || 1);
      groups[key].originalItems.push(item);
    });
    return Object.values(groups);
  };

  const toggleExpandGroup = (orderId: string, groupKey: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [`${orderId}_${groupKey}`]: !prev[`${orderId}_${groupKey}`]
    }));
  };

  const syncInventoryConsumptionToDb = async (newCons: Record<string, Record<string, number>>) => {
    try {
      const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
      const key = isDbMultiTenant ? 'laundry_inventory_consumption' : `${laundryId}_laundry_inventory_consumption`;
      const payload: any = {
        key,
        value: newCons,
        updated_at: new Date().toISOString()
      };
      if (isDbMultiTenant) {
        payload.laundry_id = laundryId;
      }

      const { error } = await supabase
        .from('settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) {
        console.error("Error syncing inventory consumption to Supabase settings:", error);
      } else {
        console.log("Successfully synced inventory consumption!");
      }
    } catch (e) {
      console.error("Exception in syncInventoryConsumptionToDb:", e);
    }
  };

  const syncCategoriesOrderToDb = async (orderedNames: string[]) => {
    try {
      const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
      const key = isDbMultiTenant ? 'laundry_categories_order' : `${laundryId}_laundry_categories_order`;
      localStorage.setItem(key, JSON.stringify(orderedNames));
      
      const payload: any = {
        key,
        value: orderedNames,
        updated_at: new Date().toISOString()
      };
      if (isDbMultiTenant) {
        payload.laundry_id = laundryId;
      }

      const { error } = await supabase
        .from('settings')
        .upsert(payload, { onConflict: 'key' });

      if (error) {
        console.error("Error syncing categories order to Supabase settings:", error);
      } else {
        console.log("Successfully synced categories order!");
      }
    } catch (e) {
      console.error("Exception in syncCategoriesOrderToDb:", e);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    const updated = [...categories];
    const draggedItem = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, draggedItem);
    setCategories(updated);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    const orderNames = categories.map(c => c.name);
    syncCategoriesOrderToDb(orderNames);
  };

  const [isEditingPrices, setIsEditingPrices] = useState(false);
  const [editingCategoryModalIndex, setEditingCategoryModalIndex] = useState<number | null>(null);
  const [editingCategoryForm, setEditingCategoryForm] = useState<{
    id?: string;
    name: string;
    icon: string;
    price: number;
    price_normal: number;
    price_urgent: number;
    price_ironing: number;
  }>({ name: '', icon: '✨', price: 0, price_normal: 0, price_urgent: 0, price_ironing: 0 });
  const [editingCategoryConsumptions, setEditingCategoryConsumptions] = useState<Record<string, number>>({});
  const [showEditCategoryIconPicker, setShowEditCategoryIconPicker] = useState(false);
  const [showCustomItemModal, setShowCustomItemModal] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [customItemForm, setCustomItemForm] = useState({ name: '', price: 0, price_normal: 0, price_urgent: 0, price_ironing: 0, price_no_ironing: 0, icon: '✨' });

  const [isAddingCustomItem, setIsAddingCustomItem] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [showDeleteCategoryConfirm, setShowDeleteCategoryConfirm] = useState(false);
  const isAddingCustomItemRef = useRef(false);
  const isSavingCategoryRef = useRef(false);
  const isDeletingCategoryRef = useRef(false);
  const lastItemAddClickTimeRef = useRef<{ name: string; time: number }>({ name: '', time: 0 });

  const [sendingMessageIds, setSendingMessageIds] = useState<Set<string>>(new Set());
  const [timeFilter, setTimeFilter] = useState<'all' | '1h' | '24h' | '48h'>('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const [showPrintModal, setShowPrintModal] = useState<Order | null>(null);
  const [showEditOrderModal, setShowEditOrderModal] = useState<Order | null>(null);
  const [originalOrder, setOriginalOrder] = useState<Order | null>(null);
  const [editOrderItems, setEditOrderItems] = useState<LaundryItem[]>([]);
  const [editCustomAdjustment, setEditCustomAdjustment] = useState<number>(0);
  const [editDiscountPercent, setEditDiscountPercent] = useState<number>(0);
  const [editIsTaxEnabled, setEditIsTaxEnabled] = useState<boolean>(true);
  const [editedSubscription, setEditedSubscription] = useState<Subscription | null>(null);
  const [isEditingSub, setIsEditingSub] = useState<boolean>(false);
  const [subDeleteConfirmId, setSubDeleteConfirmId] = useState<string | null>(null);

  const [financeFromDate, setFinanceFromDate] = useState<string>('');
  const [financeToDate, setFinanceToDate] = useState<string>('');
  const [financeSelectedClientPhone, setFinanceSelectedClientPhone] = useState<string>('all');
  const [financePendingFilter, setFinancePendingFilter] = useState<'all' | 'has_pending' | 'no_pending'>('all');
  const [financeClientSearch, setFinanceClientSearch] = useState<string>('');

  const uniqueClients = useMemo(() => {
    const clientsMap: Record<string, { name: string, phone: string }> = {};
    orders.forEach(o => {
      if (o.customer_phone) {
        const ph = o.customer_phone.trim();
        if (ph) {
          clientsMap[ph] = {
            name: o.customer_name || 'عميل مجهول',
            phone: ph
          };
        }
      }
    });
    subscriptions.forEach(s => {
      if (s.customer_phone) {
        const ph = s.customer_phone.trim();
        if (ph) {
          clientsMap[ph] = {
            name: s.customer_name || 'عميل مجهول',
            phone: ph
          };
        }
      }
    });
    return Object.values(clientsMap).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [orders, subscriptions]);

  const filteredFinanceOrders = useMemo(() => {
    return orders.filter(order => {
      // 1. Date Filter
      if (financeFromDate) {
        const orderDate = new Date(order.created_at);
        const fromDateObj = new Date(financeFromDate);
        fromDateObj.setHours(0, 0, 0, 0);
        if (orderDate < fromDateObj) return false;
      }
      if (financeToDate) {
        const orderDate = new Date(order.created_at);
        const toDateObj = new Date(financeToDate);
        toDateObj.setHours(23, 59, 59, 999);
        if (orderDate > toDateObj) return false;
      }
      
      // 2. Client Filter
      if (financeSelectedClientPhone !== 'all') {
        if (order.customer_phone !== financeSelectedClientPhone) return false;
      }
      
      return true;
    });
  }, [orders, financeFromDate, financeToDate, financeSelectedClientPhone]);

  const financeStats = useMemo(() => {
    const filteredPaidOrders = filteredFinanceOrders.filter(o => o.is_paid);
    const totalRevenue = filteredPaidOrders.reduce((acc, o) => acc + o.total, 0);
    const taxTotal = filteredPaidOrders.reduce((acc, o) => acc + o.tax, 0);
    const pendingAmount = filteredFinanceOrders.filter(o => !o.is_paid).reduce((acc, o) => acc + o.total, 0);
    const totalOrdersCount = filteredFinanceOrders.length;
    const paidOrdersCount = filteredPaidOrders.length;
    const pendingOrdersCount = filteredFinanceOrders.filter(o => !o.is_paid).length;
    
    const cashRevenue = filteredPaidOrders.filter(o => o.payment_method === 'Cash').reduce((acc, o) => acc + o.total, 0);
    const cardRevenue = filteredPaidOrders.filter(o => o.payment_method === 'Card').reduce((acc, o) => acc + o.total, 0);
    const transferRevenue = filteredPaidOrders.filter(o => o.payment_method === 'Transfer').reduce((acc, o) => acc + o.total, 0);
    
    // Group client statistics under the current filter
    const clientMap: Record<string, { 
      name: string, 
      phone: string, 
      totalOrders: number, 
      totalSpent: number, 
      pendingSpent: number, 
      lastOrderDate: string,
      hasSubscription: boolean,
      subscriptionPlanName: string | null,
      itemsRemaining: number,
      totalItems: number,
      subscriptionExpiry: string | null,
      subscriptionIsActive: boolean
    }> = {};

    // Pre-populate if a specific client is selected to ensure they show up even with 0 orders in the filtered range
    if (financeSelectedClientPhone !== 'all') {
      const selectedClient = uniqueClients.find(c => c.phone === financeSelectedClientPhone);
      if (selectedClient) {
        const clientOrders = orders.filter(o => o.customer_phone === financeSelectedClientPhone);
        let latestDate = '';
        if (clientOrders.length > 0) {
          latestDate = clientOrders.reduce((latest, o) => {
            return !latest || new Date(o.created_at) > new Date(latest) ? o.created_at : latest;
          }, '');
        }
        
        clientMap[financeSelectedClientPhone] = {
          name: selectedClient.name,
          phone: financeSelectedClientPhone,
          totalOrders: 0,
          totalSpent: 0,
          pendingSpent: 0,
          lastOrderDate: latestDate,
          hasSubscription: false,
          subscriptionPlanName: null,
          itemsRemaining: 0,
          totalItems: 0,
          subscriptionExpiry: null,
          subscriptionIsActive: false
        };
      }
    }
    
    filteredFinanceOrders.forEach(o => {
      const phone = o.customer_phone || 'unspecified';
      if (!clientMap[phone]) {
        clientMap[phone] = {
          name: o.customer_name || 'عميل مجهول',
          phone: phone,
          totalOrders: 0,
          totalSpent: 0,
          pendingSpent: 0,
          lastOrderDate: o.created_at,
          hasSubscription: false,
          subscriptionPlanName: null,
          itemsRemaining: 0,
          totalItems: 0,
          subscriptionExpiry: null,
          subscriptionIsActive: false
        };
      }
      
      const client = clientMap[phone];
      client.totalOrders += 1;
      if (o.is_paid) {
        client.totalSpent += o.total;
      } else {
        client.pendingSpent += o.total;
      }
      if (!client.lastOrderDate || new Date(o.created_at) > new Date(client.lastOrderDate)) {
        client.lastOrderDate = o.created_at;
      }
    });

    // Enrich clients with subscription details
    Object.keys(clientMap).forEach(phone => {
      if (phone === 'unspecified') return;
      const clientSub = subscriptions.find(s => s.customer_phone === phone);
      if (clientSub) {
        const subPackage = subscriptionPackages.find(p => p.id === clientSub.package_id);
        const client = clientMap[phone];
        client.hasSubscription = true;
        client.subscriptionPlanName = subPackage ? subPackage.name : 'باقة مخصصة';
        client.itemsRemaining = clientSub.items_remaining;
        client.totalItems = clientSub.total_items;
        client.subscriptionExpiry = clientSub.expiry_date;
        const expD = clientSub.expiry_date ? new Date(clientSub.expiry_date) : null;
        client.subscriptionIsActive = clientSub.is_active && expD !== null && !isNaN(expD.getTime()) && (expD >= new Date());
      }
    });
    
    const clientList = Object.values(clientMap).sort((a, b) => b.totalSpent - a.totalSpent);
    
    return {
      totalRevenue,
      taxTotal,
      pendingAmount,
      totalOrdersCount,
      paidOrdersCount,
      pendingOrdersCount,
      cashRevenue,
      cardRevenue,
      transferRevenue,
      clientList
    };
  }, [filteredFinanceOrders, subscriptions, subscriptionPackages, financeSelectedClientPhone, uniqueClients, orders]);

  useEffect(() => {
    if (showEditOrderModal) {
      setEditOrderItems(showEditOrderModal.items || []);
      setEditCustomAdjustment(showEditOrderModal.custom_adjustment || 0);
      const discount = (showEditOrderModal.items?.[0] as any)?.discount_percent || 0;
      setEditDiscountPercent(discount);
      setEditIsTaxEnabled(showEditOrderModal.tax > 0);
      
      const sub = getCustomerSubscription(showEditOrderModal.customer_phone);
      setEditedSubscription(sub ? JSON.parse(JSON.stringify(sub)) : null);
      setIsEditingSub(false);
      setSubDeleteConfirmId(null);
    } else {
      setEditOrderItems([]);
      setEditCustomAdjustment(0);
      setEditDiscountPercent(0);
      setEditIsTaxEnabled(true);
      setEditedSubscription(null);
      setIsEditingSub(false);
      setSubDeleteConfirmId(null);
    }
  }, [showEditOrderModal?.id, showEditOrderModal?.customer_phone, subscriptions]);

  const editSubtotal = useMemo(() => {
    if (!showEditOrderModal) return 0;
    if (showEditOrderModal.payment_method === 'Free') return 0;
    const itemsTotal = editOrderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const sub = itemsTotal + (editCustomAdjustment || 0);
    const discount = sub * (editDiscountPercent / 100);
    return Math.max(0, sub - discount);
  }, [editOrderItems, editCustomAdjustment, editDiscountPercent, showEditOrderModal?.payment_method]);

  const editTax = useMemo(() => {
    return editIsTaxEnabled ? editSubtotal * TAX_RATE : 0;
  }, [editSubtotal, editIsTaxEnabled]);

  const editTotal = useMemo(() => {
    return editSubtotal + editTax;
  }, [editSubtotal, editTax]);

  const updateEditItemQuantity = (id: string, delta: number) => {
    setEditOrderItems(prev => prev.map(i => {
      if (i.id === id) {
        return { ...i, quantity: i.quantity + delta };
      }
      return i;
    }).filter(i => i.quantity > 0));
  };

  const updateEditItemOption = (id: string, option: 'urgent' | 'ironing' | 'no_ironing' | 'normal', enabled: boolean) => {
    setEditOrderItems(prev => prev.map(i => {
      if (i.id === id) {
        const prices = getItemPrices(i);
        const normal = prices.price_normal;
        const urgent = prices.price_urgent;
        const ironing = prices.price_ironing;
        const noIron = prices.price_no_ironing;

        const basePrice = i.base_price !== undefined ? i.base_price : (i.price ?? 5);

        const is_normal = option === 'normal' ? enabled : (i.is_normal || false);
        const is_urgent = option === 'urgent' ? enabled : (i.is_urgent || false);
        const is_ironing_only = option === 'ironing' ? enabled : (i.is_ironing_only || false);
        const is_no_ironing = option === 'no_ironing' ? enabled : (i.is_no_ironing || false);

        let finalPrice = basePrice;
        if (is_normal) {
          finalPrice += normal;
        }
        if (is_urgent) {
          finalPrice += urgent;
        }
        if (is_ironing_only) {
          finalPrice += ironing;
        }
        if (is_no_ironing) {
          finalPrice += noIron;
        }

        return {
          ...i,
          is_normal,
          is_urgent,
          is_ironing_only,
          is_no_ironing,
          service_type: is_urgent ? 'مستعجل' : (is_normal ? 'عادي' : undefined),
          ironing_type: is_ironing_only ? 'كوي فقط' : (is_no_ironing ? 'بدون كوي' : 'غسيل وكوي'),
          price: finalPrice,
          base_price: basePrice
        };
      }
      return i;
    }));
  };

  const updateEditItemMode = (id: string, mode: 'عادي' | 'مستعجل' | 'كوي' | 'بدون كوي') => {
    const item = editOrderItems.find(i => i.id === id);
    if (!item) return;

    if (mode === 'عادي') {
      const isNormal = item.is_normal || false;
      updateEditItemOption(id, 'normal', !isNormal);
    } else if (mode === 'مستعجل') {
      const isUrgent = item.is_urgent || item.service_type === 'مستعجل' || false;
      updateEditItemOption(id, 'urgent', !isUrgent);
    } else if (mode === 'كوي') {
      const isIroning = item.is_ironing_only || false;
      updateEditItemOption(id, 'ironing', !isIroning);
    } else if (mode === 'بدون كوي') {
      const isNoIron = item.is_no_ironing || false;
      updateEditItemOption(id, 'no_ironing', !isNoIron);
    }
  };

  const updateEditItemCustomPrice = (id: string, type: 'normal' | 'urgent' | 'ironing' | 'no_ironing', priceValue: number) => {
    setEditOrderItems(prev => prev.map(i => {
      if (i.id === id) {
        const prices = getItemPrices(i);
        const normal = prices.price_normal;
        const urgent = prices.price_urgent;
        const ironing = prices.price_ironing;
        const noIron = prices.price_no_ironing;

        const updatedPrices = {
          price_normal: type === 'normal' ? priceValue : normal,
          price_urgent: type === 'urgent' ? priceValue : urgent,
          price_ironing: type === 'ironing' ? priceValue : ironing,
          price_no_ironing: type === 'no_ironing' ? priceValue : noIron,
        };

        const is_normal = i.is_normal || false;
        const is_urgent = i.is_urgent || (i.service_type === 'مستعجل') || false;
        const is_ironing_only = i.is_ironing_only || (i.ironing_type === 'كوي فقط') || false;
        const is_no_ironing = i.is_no_ironing || (i.ironing_type === 'بدون كوي') || false;

        const basePrice = i.base_price !== undefined ? i.base_price : (i.price ?? 5);

        let activePrice = basePrice;
        if (is_normal) {
          activePrice += updatedPrices.price_normal;
        }
        if (is_urgent) {
          activePrice += updatedPrices.price_urgent;
        }
        if (is_ironing_only) {
          activePrice += updatedPrices.price_ironing;
        }
        if (is_no_ironing) {
          activePrice += updatedPrices.price_no_ironing;
        }

        return {
          ...i,
          price: activePrice,
          ...updatedPrices
        };
      }
      return i;
    }));
  };
  const [isInvModalOpen, setIsInvModalOpen] = useState(false);
  const [newInvItem, setNewInvItem] = useState<{
    name: string;
    stock: number;
    unit: string;
    threshold: number;
    defaultConsumption?: number;
  }>({ name: '', stock: 0, unit: 'قطعة', threshold: 5, defaultConsumption: 10 });
  const [newInvConsumption, setNewInvConsumption] = useState<Record<string, number>>({});
  const [editingInvConsumptionItem, setEditingInvConsumptionItem] = useState<InventoryItem | null>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [showAssignSubModal, setShowAssignSubModal] = useState<{ name: string, phone: string } | null>(null);
  const [packageForm, setPackageForm] = useState<{
    name: string;
    total_items: number | string;
    price: number | string;
    duration_days: number | string;
    discount_percent: number | string;
    isUnlimitedDays?: boolean;
  }>({ name: '', total_items: '', price: '', duration_days: 30, discount_percent: '', isUnlimitedDays: false });
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  
  const scanIntervalRef = useRef<number | null>(null);
  const isSubmittingOrderRef = useRef<boolean>(false);

  useEffect(() => {
    // Auth listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id, session);
    });

    supabase.from('orders').select('id', { count: 'exact', head: true }).limit(1)
      .then(({ error }) => {
        if (error) console.error("Supabase connection check failed:", error);
        else console.log("Supabase connection established.");
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id, session);
      else setUserProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
      fetchSettings();
      if (userProfile) fetchProfiles();
    }
  }, [session, userProfile]);

  useEffect(() => {
    if (twilioConfig.enabled && session) {
      scanIntervalRef.current = window.setInterval(checkAndSendAutoReminders, 1000 * 60 * 5);
      return () => { if (scanIntervalRef.current) window.clearInterval(scanIntervalRef.current); };
    }
  }, [twilioConfig, orders, session]);

  const fetchUserProfile = async (userId: string, activeSession?: any) => {
    try {
      // Fetch custom permissions map from settings table (robust fallback for permissions column)
      let customPerms: Record<string, string[]> = {};
      try {
        const { data: permsData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_user_permissions_map');
        if (permsData && permsData.length > 0 && permsData[0].value) {
          customPerms = permsData[0].value as Record<string, string[]>;
        }
      } catch (permsErr) {
        console.warn("Could not read permissions map from settings", permsErr);
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.warn("Profile table fetch failed, checking user_metadata fallback...", error);
        const metadata = activeSession?.user?.user_metadata || session?.user?.user_metadata;
        const fallbackEmail = activeSession?.user?.email || session?.user?.email || '';
        
        // Build an extremely resilient fallback profile, defaulting to 'admin' so the user gets immediate access
        const fallbackProfile: UserProfile = {
          id: userId,
          email: fallbackEmail,
          role: (metadata?.role || 'admin') as UserRole,
          full_name: metadata?.full_name || fallbackEmail.split('@')[0] || 'مستخدم تجريبي',
          laundry_id: ensureUUID(metadata?.laundry_id || userId),
          laundry_name: metadata?.laundry_name || 'مغسلة نظافة وعود السحابية',
          saas_plan: (metadata?.saas_plan || 'gold') as any,
          saas_expiry: metadata?.saas_expiry || new Date(Date.now() + 365*24*60*60*1000).toISOString(),
          saas_status: metadata?.saas_status || 'active',
          permissions: customPerms[userId] !== undefined 
            ? customPerms[userId] 
            : (metadata?.permissions !== undefined ? metadata.permissions : (ROLE_PERMISSIONS[(metadata?.role || 'admin') as UserRole] || []))
        };
        
        setUserProfile(fallbackProfile);
        
        // Attempt profile self-healing in database asynchronously
        try {
          // Exclude 'permissions' from save payload to prevent database column errors
          const { permissions, ...profileToSave } = fallbackProfile;
          await supabase.from('profiles').upsert(profileToSave);
          console.log("Successfully auto-healed missing profile entry in Supabase database.");
        } catch (healErr) {
          console.warn("Profile table self-healing failed, but using resilient fallback:", healErr);
        }
        return;
      }
      if (data) {
        const metadata = activeSession?.user?.user_metadata || session?.user?.user_metadata;
        const checkedLaundryId = data.laundry_id ? ensureUUID(data.laundry_id) : ensureUUID(userId);
        const updatedProfile = {
          ...data,
          laundry_id: checkedLaundryId,
          permissions: customPerms[userId] !== undefined 
            ? customPerms[userId] 
            : (metadata?.permissions !== undefined ? metadata.permissions : (ROLE_PERMISSIONS[data.role as UserRole] || []))
        };
        setUserProfile(updatedProfile);
        
        // If laundry_id was missing from the DB, save the self-healed value
        if (!data.laundry_id) {
          try {
            await supabase.from('profiles').update({ laundry_id: checkedLaundryId }).eq('id', userId);
            console.log("Self-healed missing laundry_id in profiles table for user:", userId);
          } catch (updateErr) {
            console.warn("Failed to persist self-healed laundry_id:", updateErr);
          }
        }
      }
    } catch (e) {
      console.error("Failed to fetch profile, using resilient admin fallback:", e);
      // Absolute fallback if everything fails
      const fallbackEmail = activeSession?.user?.email || session?.user?.email || '';
      setUserProfile({
        id: userId,
        email: fallbackEmail,
        role: 'admin',
        full_name: fallbackEmail.split('@')[0] || 'مستخدم تجريبي',
        laundry_id: ensureUUID(userId),
        laundry_name: 'مغسلة نظافة وعود السحابية',
        saas_plan: 'gold',
        saas_expiry: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
        saas_status: 'active',
        permissions: ROLE_PERMISSIONS['admin']
      });
    }
  };

  const fetchLaundries = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'platform_laundries_list')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data && data.value && Array.isArray(data.value)) {
        setLaundries(data.value);
      } else {
        const defaultLaundries = [
          { id: ensureUUID(userProfile?.laundry_id || 'laund-unknown'), name: userProfile?.laundry_name || 'مغسلة نظافة وعود السحابية' }
        ];
        setLaundries(defaultLaundries);
        
        await supabase
          .from('settings')
          .upsert({
            key: 'platform_laundries_list',
            value: defaultLaundries,
            updated_at: new Date().toISOString()
          });
      }
    } catch (e) {
      console.error("Failed to fetch laundries from settings, falling back to current profile:", e);
      setLaundries([
        { id: ensureUUID(userProfile?.laundry_id || 'laund-unknown'), name: userProfile?.laundry_name || 'مغسلة نظافة وعود السحابية' }
      ]);
    }
  };

  const addLaundryToPlatform = async (id: string, name: string) => {
    try {
      let currentList = [...laundries];
      if (!currentList.some((l: any) => l.id === id)) {
        currentList.push({ id, name });
        await supabase
          .from('settings')
          .upsert({
            key: 'platform_laundries_list',
            value: currentList,
            updated_at: new Date().toISOString()
          });
        setLaundries(currentList);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to add laundry to platform settings:", e);
      return false;
    }
  };

  const fetchProfiles = async () => {
    try {
      // Fetch laundries too to keep it synchronized
      fetchLaundries();

      // Fetch user custom permissions map
      let customPerms: Record<string, string[]> = {};
      try {
        const { data: permsData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_user_permissions_map');
        if (permsData && permsData.length > 0 && permsData[0].value) {
          customPerms = permsData[0].value as Record<string, string[]>;
        }
      } catch (permsErr) {
        console.warn("Failed to fetch user permissions map from settings:", permsErr);
      }

      // Fetch only user profiles belonging to the current laundry_id for strict multi-tenant isolation
      const userLaundryId = userProfile?.laundry_id;
      let query = supabase.from('profiles').select('*');
      if (userLaundryId) {
        query = query.eq('laundry_id', userLaundryId);
      }
      
      const { data, error } = await query.order('updated_at', { ascending: false });
        
      if (error) throw error;

      // Enrich profiles with custom permissions from settings
      const enriched = (data || []).map((p: any) => ({
        ...p,
        permissions: customPerms[p.id] !== undefined ? customPerms[p.id] : (ROLE_PERMISSIONS[p.role as UserRole] || [])
      }));
      setProfiles(enriched);
    } catch (e) {
      console.error("Failed to fetch profiles:", e);
    }
  };

  useEffect(() => {
    if (userProfile) {
      setNewStaffForm(prev => ({
        ...prev,
        laundry_id: userProfile.laundry_id || '',
        laundry_name: userProfile.laundry_name || '',
      }));
    }
  }, [userProfile]);

  const handleCreateStaffAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.email.trim() || !newStaffForm.password.trim() || !newStaffForm.full_name.trim()) {
      alert('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if (newStaffForm.password.length < 6) {
      alert('كلمة المرور يجب أن تكون 6 خانات على الأقل');
      return;
    }

    setCreateStaffLoading(true);
    try {
      const tempSupabase = createClient('https://hoeealjgmfjbojjyodql.supabase.co', 'sb_publishable_Vq7v3naqK8moAXa-L8EwOw_Rpjc55mw', {
        auth: { persistSession: false }
      });

      // Sign up the user in Auth
      const { data: signUpData, error: signUpError } = await tempSupabase.auth.signUp({
        email: newStaffForm.email,
        password: newStaffForm.password,
        options: {
          data: {
            full_name: newStaffForm.full_name,
            role: newStaffForm.role,
            laundry_id: newStaffForm.laundry_id,
            laundry_name: newStaffForm.laundry_name,
            permissions: newStaffForm.permissions
          }
        }
      });

      if (signUpError) throw signUpError;
      
      const newUserId = signUpData?.user?.id;
      if (!newUserId) {
        throw new Error('فشل الحصول على معرّف المستخدم الجديد من نظام المصادقة');
      }

      // Upsert directly into profiles (EXCLUDING permissions column to prevent database schema error)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          email: newStaffForm.email,
          role: newStaffForm.role,
          full_name: newStaffForm.full_name,
          laundry_id: newStaffForm.laundry_id,
          laundry_name: newStaffForm.laundry_name,
          saas_plan: 'gold',
          saas_expiry: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
          saas_status: 'active'
        });

      if (profileError) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            email: newStaffForm.email,
            role: newStaffForm.role,
            full_name: newStaffForm.full_name,
            laundry_id: newStaffForm.laundry_id,
            laundry_name: newStaffForm.laundry_name
          })
          .eq('id', newUserId);
        if (updateError) throw updateError;
      }

      // Save custom permissions to the setting map safely
      try {
        let currentMap: Record<string, string[]> = {};
        const { data: mData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_user_permissions_map');
        if (mData && mData.length > 0 && mData[0].value) {
          currentMap = mData[0].value as Record<string, string[]>;
        }
        
        currentMap[newUserId] = newStaffForm.permissions;
        
        await supabase
          .from('settings')
          .upsert({
            key: 'platform_user_permissions_map',
            value: currentMap,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (permsErr) {
        console.warn("Could not persist custom permissions in settings table", permsErr);
      }

      // Ensure the laundry is added to the list in platform settings
      if (newStaffForm.laundry_id && newStaffForm.laundry_name) {
        await addLaundryToPlatform(newStaffForm.laundry_id, newStaffForm.laundry_name);
      }

      alert('تم إنشاء حساب المستخدم بنجاح وربطه بالمغسلة المحددة! 🎉');
      
      setNewStaffForm(prev => ({
        ...prev,
        email: '',
        password: '',
        full_name: '',
        permissions: ['dashboard', 'new-order', 'orders']
      }));

      fetchProfiles();
      setIsCreatingUser(false);
    } catch (err: any) {
      alert(`فشل إنشاء الحساب: ${err.message || err}`);
    } finally {
      setCreateStaffLoading(false);
    }
  };

  const handleUpdateUserProfile = async () => {
    if (!editingUserProfile) return;
    setSaveLoading(true);
    try {
      // Exclude 'permissions' column from database update to prevent schema column error
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editingUserForm.full_name,
          role: editingUserForm.role,
          laundry_id: editingUserForm.laundry_id,
          laundry_name: editingUserForm.laundry_name
        })
        .eq('id', editingUserProfile.id);

      if (error) throw error;

      // Update custom permissions in setting map safely
      try {
        let currentMap: Record<string, string[]> = {};
        const { data: mData } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'platform_user_permissions_map');
        if (mData && mData.length > 0 && mData[0].value) {
          currentMap = mData[0].value as Record<string, string[]>;
        }
        
        currentMap[editingUserProfile.id] = editingUserForm.permissions;
        
        await supabase
          .from('settings')
          .upsert({
            key: 'platform_user_permissions_map',
            value: currentMap,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (permsErr) {
        console.warn("Could not save custom permissions map:", permsErr);
      }

      // Ensure the laundry is added to platform laundries settings
      if (editingUserForm.laundry_id && editingUserForm.laundry_name) {
        await addLaundryToPlatform(editingUserForm.laundry_id, editingUserForm.laundry_name);
      }
      
      setProfiles(prev => prev.map(p => p.id === editingUserProfile.id ? {
        ...p,
        full_name: editingUserForm.full_name,
        role: editingUserForm.role,
        laundry_id: editingUserForm.laundry_id,
        laundry_name: editingUserForm.laundry_name,
        permissions: editingUserForm.permissions
      } : p));

      if (editingUserProfile.id === session?.user?.id) {
        try {
          await supabase.auth.updateUser({
            data: {
              full_name: editingUserForm.full_name,
              role: editingUserForm.role,
              laundry_id: editingUserForm.laundry_id,
              laundry_name: editingUserForm.laundry_name,
              permissions: editingUserForm.permissions
            }
          });
        } catch (authErr) {
          console.warn("Could not update auth user metadata:", authErr);
        }

        setUserProfile(prev => prev ? {
          ...prev,
          full_name: editingUserForm.full_name,
          role: editingUserForm.role,
          laundry_id: editingUserForm.laundry_id,
          laundry_name: editingUserForm.laundry_name,
          permissions: editingUserForm.permissions
        } : null);
      }

      alert('تم تحديث بيانات المستخدم وصلاحياته بنجاح ✅');
      setEditingUserProfile(null);
    } catch (e: any) {
      alert(`فشل التحديث: ${e.message}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    try {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
      if (error) throw error;
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role } : p));
      alert('تم تحديث صلاحية المستخدم بنجاح');
    } catch (e: any) {
      alert(`فشل التحديث: ${e.message}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === session?.user?.id) {
      alert('لا يمكنك حذف حسابك الحالي! ❌');
      return;
    }
    setDeletingUserId(userId);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      setProfiles(prev => prev.filter(p => p.id !== userId));
      setUserToDelete(null);
    } catch (e: any) {
      alert(`فشل الحذف: ${e.message}`);
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const allowedNavItems = useMemo(() => {
    if (!userProfile) return [];
    const permissions = (userProfile.permissions !== undefined && userProfile.permissions !== null)
      ? userProfile.permissions
      : (ROLE_PERMISSIONS[userProfile.role] || []);
    return navItems.filter(item => permissions.includes(item.id));
  }, [userProfile]);

  // Ensure active tab is allowed
  useEffect(() => {
    if (userProfile) {
      const permissions = (userProfile.permissions !== undefined && userProfile.permissions !== null)
        ? userProfile.permissions
        : (ROLE_PERMISSIONS[userProfile.role] || []);
      if (!permissions.includes(activeTab)) {
        const firstAllowed = navItems.find(item => permissions.includes(item.id));
        if (firstAllowed) {
          setActiveTab(firstAllowed.id as any);
        } else {
          setActiveTab('dashboard');
        }
      }
    }
  }, [userProfile, activeTab]);

  const fetchSettings = async () => {
    try {
      const laundryId = userProfile?.laundry_id;
      if (!laundryId) return;
      const getTenantKey = (baseKey: string) => isDbMultiTenant ? baseKey : `${laundryId}_${baseKey}`;

      let query = supabase.from('settings').select('value').eq('key', getTenantKey('twilio'));
      if (isDbMultiTenant) {
        query = query.eq('laundry_id', laundryId);
      }
      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        setTwilioConfig(data.value);
      }
    } catch (e) {
      console.error("Failed to fetch settings from DB:", e);
    }
  };

  const saveSettingsToDB = async () => {
    setSaveLoading(true);
    try {
      const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
      const getTenantKey = (baseKey: string) => isDbMultiTenant ? baseKey : `${laundryId}_${baseKey}`;

      const payload: any = {
        key: getTenantKey('twilio'),
        value: twilioConfig,
        updated_at: new Date().toISOString()
      };
      if (isDbMultiTenant) {
        payload.laundry_id = laundryId;
      }

      const { error } = await supabase.from('settings').upsert(payload, { onConflict: 'key' });

      if (error) throw error;
      alert('تم حفظ الإعدادات في قاعدة البيانات بنجاح ✅');
    } catch (e: any) {
      alert(`فشل حفظ الإعدادات: ${e.message}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const triggerBackgroundNotification = async (order: Order, context: MessageContext) => {
    if (!twilioConfig.enabled || !twilioConfig.accountSid) return;
    try {
      const smartMsg = await generateSmartReminder(order, context);
      const fullMessage = `${smartMsg}\n\n📦 فاتورة: ${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ريال\n📍 الحالة: ${statusArabic[order.status]}\n\n${DISCLAIMER_TEXT}`;
      await sendTwilioWhatsApp(order, fullMessage, twilioConfig);
    } catch (e) {
      console.error("Background notify error:", e);
    }
  };

  const checkAndSendAutoReminders = async () => {
    if (!twilioConfig.enabled || !twilioConfig.accountSid) return;
    const now = Date.now();
    for (const order of orders) {
      if (order.status === 'Delivered') continue;
      
      const orderTime = new Date(order.created_at).getTime();
      const hoursPassed = (now - orderTime) / 3600000;
      
      let key: keyof Order | null = null;
      let context: MessageContext | null = null;

      if (hoursPassed >= 48 && !order.notified_48h) { key = 'notified_48h'; context = 'REMINDER_48H'; }
      else if (hoursPassed >= 24 && !order.notified_24h) { key = 'notified_24h'; context = 'REMINDER_24H'; }
      else if (hoursPassed >= 1 && !order.notified_1h) { key = 'notified_1h'; context = 'REMINDER_1H'; }

      if (key && context) {
        try {
          const smartMsg = await generateSmartReminder(order, context);
          const fullMessage = `${smartMsg}\n\n📦 فاتورة: ${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ريال\n📍 الحالة: ${statusArabic[order.status]}\n\n${DISCLAIMER_TEXT}`;
          const success = await sendTwilioWhatsApp(order, fullMessage, twilioConfig);
          if (success) {
            await supabase.from('orders').update({ [key]: true }).eq('id', order.id);
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, [key]: true } : o));
          }
        } catch (e) { console.error("Auto Send Fail:", e); }
      }
    }
  };

  const getMergedCategories = (rawCategories: any[], pricesDict?: Record<string, any>) => {
    let storedPrices: Record<string, any> = {};
    if (pricesDict) {
      storedPrices = pricesDict;
    } else if (Object.keys(customPrices).length > 0) {
      storedPrices = customPrices;
    } else {
      try {
        const stored = localStorage.getItem("laundry_categories_custom_prices");
        if (stored) {
          storedPrices = JSON.parse(stored);
        }
      } catch (e) {
        console.error("Error reading custom prices from localStorage:", e);
      }
    }

    return rawCategories.map((cat: any) => {
      const custom = storedPrices[cat.name] || {};
      const price_normal = custom.price_normal !== undefined && custom.price_normal !== null ? custom.price_normal : (cat.price_normal !== undefined && cat.price_normal !== null ? cat.price_normal : (cat.price ?? 5));
      const price_urgent = custom.price_urgent !== undefined && custom.price_urgent !== null ? custom.price_urgent : (cat.price_urgent !== undefined && cat.price_urgent !== null ? cat.price_urgent : price_normal * 2);
      const price_ironing = custom.price_ironing !== undefined && custom.price_ironing !== null ? custom.price_ironing : (cat.price_ironing !== undefined && cat.price_ironing !== null ? cat.price_ironing : price_normal * 0.5);
      const price_no_ironing = custom.price_no_ironing !== undefined && custom.price_no_ironing !== null ? custom.price_no_ironing : (cat.price_no_ironing !== undefined && cat.price_no_ironing !== null ? cat.price_no_ironing : price_normal * 0.8);
      
      return {
        ...cat,
        price_normal,
        price_urgent,
        price_ironing,
        price_no_ironing,
        price: price_normal
      };
    });
  };

  const fetchData = async () => {
    const laundryId = userProfile?.laundry_id;
    if (!laundryId) {
      console.warn("fetchData skipped: laundry_id is not yet available in userProfile.");
      setOrders([]);
      setInventory([]);
      setSubscriptions([]);
      setSubscriptionPackages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDbError(null);
    try {
      // Auto-detect schema multi-tenancy dynamically
      let isMulti = false;
      try {
        const { error } = await supabase.from('orders').select('laundry_id').limit(1);
        if (!error || (error && error.code !== '42703')) {
          isMulti = true;
        }
      } catch (e) {}
      setIsDbMultiTenant(isMulti);

      // Helper to dynamically get tenant keys for Settings
      const getTenantKey = (baseKey: string) => isMulti ? baseKey : `${laundryId}_${baseKey}`;

      // 1. Fetch Orders
      let ordersQuery = supabase.from('orders').select('*');
      if (isMulti && laundryId) {
        ordersQuery = ordersQuery.eq('laundry_id', laundryId);
      }
      const { data: ordersData, error: ordersError } = await ordersQuery.order('created_at', { ascending: false });
      if (ordersError) throw ordersError;

      let processedOrders = ordersData || [];
      if (laundryId) {
        if (!isMulti) {
          processedOrders = processedOrders.filter((o: any) => 
            (o.order_number && o.order_number.startsWith(`${laundryId}-`)) || 
            (o.customer_phone && o.customer_phone.startsWith(`${laundryId}|`))
          );
        }
        processedOrders = processedOrders.map((o: any) => ({
          ...o,
          order_number: cleanTenantString(o.order_number),
          customer_name: cleanTenantString(o.customer_name),
          customer_phone: cleanTenantString(o.customer_phone)
        }));
      }
      setOrders(processedOrders);

      // 2. Fetch Inventory
      let invQuery = supabase.from('inventory').select('*');
      if (isMulti && laundryId) {
        invQuery = invQuery.eq('laundry_id', laundryId);
      }
      const { data: inventoryData, error: invError } = await invQuery;
      if (invError) throw invError;

      let processedInventory = inventoryData || [];
      if (laundryId) {
        if (!isMulti) {
          processedInventory = processedInventory.filter((i: any) => i.name && i.name.startsWith(`${laundryId}|`));
        }
        processedInventory = processedInventory.map((i: any) => ({
          ...i,
          name: cleanTenantString(i.name)
        }));
      }
      setInventory(processedInventory);

      // 3. Fetch Subscriptions
      let subsQuery = supabase.from('subscriptions').select('*');
      if (isMulti && laundryId) {
        subsQuery = subsQuery.eq('laundry_id', laundryId);
      }
      const { data: subsData, error: subsError } = await subsQuery;
      if (subsError) throw subsError;

      let processedSubs = subsData || [];
      if (laundryId) {
        if (!isMulti) {
          processedSubs = processedSubs.filter((s: any) => 
            (s.customer_name && s.customer_name.startsWith(`${laundryId}|`)) || 
            (s.customer_phone && s.customer_phone.startsWith(`${laundryId}|`))
          );
        }
        processedSubs = processedSubs.map((s: any) => ({
          ...s,
          customer_name: cleanTenantString(s.customer_name),
          customer_phone: cleanTenantString(s.customer_phone)
        }));
      }
      setSubscriptions(processedSubs);

      // 4. Fetch Subscription Packages
      let pkgsQuery = supabase.from('subscription_packages').select('*');
      if (isMulti && laundryId) {
        pkgsQuery = pkgsQuery.eq('laundry_id', laundryId);
      }
      const { data: pkgsData, error: pkgsError } = await pkgsQuery;
      if (pkgsError) throw pkgsError;

      let processedPkgs = pkgsData || [];
      if (laundryId) {
        if (!isMulti) {
          processedPkgs = processedPkgs.filter((pkg: any) => pkg.name && pkg.name.startsWith(`${laundryId}|`));
        }
        processedPkgs = processedPkgs.map((pkg: any) => {
          let name = cleanTenantString(pkg.name);
          let discount_percent = 0;
          let cleanName = name;
          if (name && name.includes(' __dp:')) {
            const parts = name.split(' __dp:');
            cleanName = parts[0];
            discount_percent = parseInt(parts[1], 10) || 0;
          }
          return {
            ...pkg,
            name: cleanName,
            discount_percent
          };
        });
      }
      setSubscriptionPackages(processedPkgs);

      // 5. Fetch custom prices
      let latestCustomPrices: Record<string, any> = {};
      try {
        let pricesQuery = supabase.from('settings').select('value').eq('key', getTenantKey('laundry_categories_custom_prices'));
        if (isMulti && laundryId) {
          pricesQuery = pricesQuery.eq('laundry_id', laundryId);
        }
        const { data: pricesSetting, error: pricesError } = await pricesQuery.maybeSingle();
        if (!pricesError && pricesSetting && pricesSetting.value) {
          latestCustomPrices = typeof pricesSetting.value === 'string'
            ? JSON.parse(pricesSetting.value)
            : pricesSetting.value;
          localStorage.setItem(getTenantKey('laundry_categories_custom_prices'), JSON.stringify(latestCustomPrices));
        } else {
          const stored = localStorage.getItem(getTenantKey('laundry_categories_custom_prices'));
          if (stored) latestCustomPrices = JSON.parse(stored);
        }
      } catch (err) {
        console.warn("Could not load custom prices:", err);
        const stored = localStorage.getItem(getTenantKey('laundry_categories_custom_prices'));
        if (stored) {
          try { latestCustomPrices = JSON.parse(stored); } catch {}
        }
      }
      setCustomPrices(latestCustomPrices);

      // 6. Fetch inventory consumption
      let latestConsumption: Record<string, Record<string, number>> = {};
      try {
        let consQuery = supabase.from('settings').select('value').eq('key', getTenantKey('laundry_inventory_consumption'));
        if (isMulti && laundryId) {
          consQuery = consQuery.eq('laundry_id', laundryId);
        }
        const { data: consumptionSetting, error: consError } = await consQuery.maybeSingle();
        if (!consError && consumptionSetting && consumptionSetting.value) {
          latestConsumption = typeof consumptionSetting.value === 'string'
            ? JSON.parse(consumptionSetting.value)
            : consumptionSetting.value;
          localStorage.setItem(getTenantKey('laundry_inventory_consumption'), JSON.stringify(latestConsumption));
        } else {
          const storedCons = localStorage.getItem(getTenantKey('laundry_inventory_consumption'));
          if (storedCons) latestConsumption = JSON.parse(storedCons);
        }
      } catch (err) {
        console.warn("Could not load inventory consumption:", err);
        const storedCons = localStorage.getItem(getTenantKey('laundry_inventory_consumption'));
        if (storedCons) {
          try { latestConsumption = JSON.parse(storedCons); } catch {}
        }
      }
      setInventoryConsumption(latestConsumption);

      // 7. Fetch categories custom order
      let categoriesOrder: string[] = [];
      try {
        let orderQuery = supabase.from('settings').select('value').eq('key', getTenantKey('laundry_categories_order'));
        if (isMulti && laundryId) {
          orderQuery = orderQuery.eq('laundry_id', laundryId);
        }
        const { data: orderSetting, error: orderError } = await orderQuery.maybeSingle();
        if (!orderError && orderSetting && orderSetting.value) {
          categoriesOrder = typeof orderSetting.value === 'string'
            ? JSON.parse(orderSetting.value)
            : orderSetting.value;
        } else {
          const storedOrder = localStorage.getItem(getTenantKey('laundry_categories_order'));
          if (storedOrder) categoriesOrder = JSON.parse(storedOrder);
        }
      } catch (err) {
        console.warn("Could not load categories order:", err);
        const storedOrder = localStorage.getItem(getTenantKey('laundry_categories_order'));
        if (storedOrder) {
          try { categoriesOrder = JSON.parse(storedOrder); } catch {}
        }
      }

      // 8. Fetch Categories
      console.log("Fetching categories from Supabase...");
      let catsQuery = supabase.from('categories').select('*');
      if (isMulti && laundryId) {
        catsQuery = catsQuery.eq('laundry_id', laundryId);
      }
      const { data: catsData, error: catsError } = await catsQuery.order('created_at', { ascending: true });
      if (catsError) throw catsError;

      let dbCats = catsData || [];
      if (laundryId && !isMulti) {
        dbCats = dbCats.filter((c: any) => c.name && c.name.startsWith(`${laundryId}|`));
      }

      // Auto-seed if empty
      if (dbCats.length === 0) {
        console.log("Database categories table is empty, auto-seeding with INITIAL_ITEMS...");
        const seedRows = INITIAL_ITEMS.map(item => {
          const row: any = {
            name: isMulti ? item.name : `${laundryId}|${item.name}`,
            price: item.price,
            icon: item.icon,
            price_normal: item.price,
            price_urgent: item.price * 2,
            price_ironing: item.price * 0.5,
            price_no_ironing: item.price * 0.8
          };
          if (isMulti) {
            row.laundry_id = laundryId;
          }
          return row;
        });

        try {
          const { data: seedData, error: seedError } = await supabase.from('categories').insert(seedRows).select();
          if (!seedError && seedData && seedData.length > 0) {
            dbCats = seedData;
            console.log("Auto-seeding categories completed successfully!");
          } else {
            console.warn("Auto-seeding categories failed, falling back to local INITIAL_ITEMS:", seedError);
          }
        } catch (seedEx) {
          console.warn("Auto-seeding categories exception caught, falling back to local INITIAL_ITEMS:", seedEx);
        }
      }

      dbCats = dbCats.map((c: any) => ({
        ...c,
        name: cleanTenantString(c.name)
      }));

      const sortCategories = (cats: any[], orderList: string[]) => {
        if (!orderList || orderList.length === 0) return cats;
        return [...cats].sort((a: any, b: any) => {
          const indexA = orderList.indexOf(a.name);
          const indexB = orderList.indexOf(b.name);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      };

      if (dbCats.length > 0) {
        console.log("Setting categories to database items.");
        const merged = getMergedCategories(dbCats, latestCustomPrices);
        setCategories(sortCategories(merged, categoriesOrder));
      } else {
        console.log("Database categories table is empty, using INITIAL_ITEMS as fallback.");
        const merged = getMergedCategories(INITIAL_ITEMS, latestCustomPrices);
        setCategories(sortCategories(merged, categoriesOrder));
      }
      setIsCategoriesLoaded(true);
    } catch (error: any) {
      console.error("Fetch Data Error:", error);
      setDbError(error.message || "فشل الاتصال بقاعدة البيانات");
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalRevenue = orders.filter(o => o.is_paid).reduce((acc, o) => acc + o.total, 0);
    const taxTotal = orders.filter(o => o.is_paid).reduce((acc, o) => acc + o.tax, 0);
    const pendingAmount = orders.filter(o => !o.is_paid).reduce((acc, o) => acc + o.total, 0);
    const pendingOrdersCount = orders.filter(o => o.status !== 'Delivered').length;
    const lowStockCount = inventory.filter(i => i.stock <= i.threshold).length;
    return { totalRevenue, taxTotal, pendingAmount, pendingOrdersCount, lowStockCount };
  }, [orders, inventory]);

  const getCustomerStats = (phone: string) => {
    const norm = normalizePhone(phone);
    if (!norm) return { totalItems: 0, freeItems: 0, paidItems: 0 };
    const customerOrders = orders.filter(o => normalizePhone(o.customer_phone) === norm);
    const totalItems = customerOrders.reduce((acc, o) => acc + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
    const freeItems = customerOrders.filter(o => o.payment_method === 'Free').reduce((acc, o) => acc + o.items.reduce((sum, item) => sum + item.quantity, 0), 0);
    const paidItems = totalItems - freeItems;
    return { totalItems, freeItems, paidItems };
  };

  const getCustomerSubscription = (phone: string) => {
    const norm = normalizePhone(phone);
    if (!norm) return undefined;
    return subscriptions.find(s => {
      if (normalizePhone(s.customer_phone) !== norm || !s.is_active || !s.expiry_date) return false;
      const d = new Date(s.expiry_date);
      return !isNaN(d.getTime()) && d > new Date();
    });
  };

  const handleCreatePackage = async () => {
    const nameTrimmed = packageForm.name ? packageForm.name.trim() : '';
    const parsedTotalItems = parseInt(packageForm.total_items as any) || 0;
    const parsedPrice = packageForm.price === '' || packageForm.price === null || packageForm.price === undefined
      ? 0
      : parseFloat(packageForm.price as any);
    const isUnlimited = !!packageForm.isUnlimitedDays || packageForm.duration_days === 0 || packageForm.duration_days === '0';
    const parsedDuration = isUnlimited
      ? 0
      : (parseInt(packageForm.duration_days as any) || 30);
    const parsedDiscount = packageForm.discount_percent === '' ? 0 : (parseFloat(packageForm.discount_percent as any) || 0);

    if (!nameTrimmed) return alert('يرجى إدخال اسم الباقة');
    if (parsedTotalItems <= 0) return alert('يرجى إدخال عدد قطع صحيح (أكبر من 0)');
    if (isNaN(parsedPrice) || parsedPrice < 0) return alert('يرجى إدخال سعر صحيح (0 أو أكثر)');

    const finalPkg: SubscriptionPackage = {
      id: editingPackageId || generateUUID(),
      name: nameTrimmed,
      total_items: parsedTotalItems,
      price: parsedPrice,
      duration_days: isUnlimited ? 0 : Math.max(0, parsedDuration),
      discount_percent: Math.min(100, Math.max(0, parsedDiscount))
    };

    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');

    if (editingPackageId) {
      // Editing existing package
      const dbPkg: any = {
        name: isDbMultiTenant ? `${finalPkg.name} __dp:${finalPkg.discount_percent}` : `${laundryId}|${finalPkg.name} __dp:${finalPkg.discount_percent}`,
        total_items: finalPkg.total_items,
        price: finalPkg.price,
        duration_days: finalPkg.duration_days
      };
      if (isDbMultiTenant) {
        dbPkg.laundry_id = laundryId;
      }
      
      try {
        const { error } = await supabase.from('subscription_packages').update(dbPkg).eq('id', editingPackageId);
        if (error) throw error;
        
        setSubscriptionPackages(prev => prev.map(p => p.id === editingPackageId ? finalPkg : p));
        
        setPackageForm({ name: '', total_items: '', price: '', duration_days: 30, discount_percent: '', isUnlimitedDays: false });
        setEditingPackageId(null);
        setShowPackageModal(false);
        alert('تم تعديل الباقة بنجاح ✅');
      } catch (e: any) {
        alert(`فشل التعديل: ${e.message}`);
      }
    } else {
      // Creating a new package
      const dbPkg: any = {
        id: finalPkg.id,
        name: isDbMultiTenant ? `${finalPkg.name} __dp:${finalPkg.discount_percent}` : `${laundryId}|${finalPkg.name} __dp:${finalPkg.discount_percent}`,
        total_items: finalPkg.total_items,
        price: finalPkg.price,
        duration_days: finalPkg.duration_days
      };
      if (isDbMultiTenant) {
        dbPkg.laundry_id = laundryId;
      }
      
      try {
        const { error } = await supabase.from('subscription_packages').insert([dbPkg]);
        if (error) throw error;
        setSubscriptionPackages(prev => [...prev, finalPkg]);
        setPackageForm({ name: '', total_items: '', price: '', duration_days: 30, discount_percent: '', isUnlimitedDays: false });
        setShowPackageModal(false);
        alert('تم إنشاء الباقة بنجاح ✅');
      } catch (e: any) {
        alert(`فشل الحفظ: ${e.message}`);
      }
    }
  };

  const handleStartEditPackage = (pkg: SubscriptionPackage) => {
    setEditingPackageId(pkg.id);
    const isUnlimited = pkg.duration_days === 0 || pkg.duration_days >= 36500;
    setPackageForm({
      name: pkg.name,
      total_items: pkg.total_items ?? '',
      price: pkg.price === 0 ? 0 : (pkg.price ?? ''),
      duration_days: isUnlimited ? 0 : (pkg.duration_days ?? 30),
      discount_percent: pkg.discount_percent === 0 ? '' : (pkg.discount_percent ?? ''),
      isUnlimitedDays: isUnlimited
    });
    setShowPackageModal(true);
  };

  const handleDeletePackage = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الباقة؟ سيتم أيضاً حذف جميع الاشتراكات المرتبطة بها.')) return;
    try {
      // Delete associated subscriptions first to prevent foreign key constraint violation
      const { error: subErr } = await supabase.from('subscriptions').delete().eq('package_id', id);
      if (subErr) throw subErr;

      const { error } = await supabase.from('subscription_packages').delete().eq('id', id);
      if (error) throw error;

      setSubscriptionPackages(subscriptionPackages.filter(p => p.id !== id));
      setSubscriptions(prev => prev.filter(sub => sub.package_id !== id));
      alert('تم حذف الباقة والاشتراكات المرتبطة بها بنجاح ✅');
    } catch (e: any) {
      alert(`فشل الحذف: ${e.message}`);
    }
  };

  const downloadGeneralExcel = () => {
    const headers = [
      'رقم الطلب',
      'اسم العميل',
      'رقم الجوال',
      'نوع الطلب',
      'المجموع الفرعي',
      'الضريبة (15%)',
      'خصم/تعديل',
      'الإجمالي',
      'حالة الدفع',
      'طريقة الدفع',
      'حالة الطلب',
      'تاريخ الإنشاء'
    ];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const translatePaymentMethod = (method: PaymentMethod) => {
      switch (method) {
        case 'Cash': return 'نقدي';
        case 'Card': return 'شبكة / مدى';
        case 'Transfer': return 'تحويل بنكي';
        case 'Subscription': return 'اشتراك';
        case 'Free': return 'طلب مجاني';
        default: return method;
      }
    };

    const translateOrderStatus = (status: OrderStatus) => {
      switch (status) {
        case 'Received': return 'تم الاستلام';
        case 'Washing': return 'جاري الغسيل';
        case 'Ironing': return 'جاري الكوي';
        case 'Ready': return 'جاهز للتسليم';
        case 'Delivered': return 'تم التسليم';
        default: return status;
      }
    };
    
    const rows = filteredFinanceOrders.map(o => [
      escapeCSV(o.order_number),
      escapeCSV(o.customer_name),
      escapeCSV(o.customer_phone),
      o.order_type === 'Urgent' ? 'مستعجل' : 'عادي',
      o.subtotal.toFixed(2),
      o.tax.toFixed(2),
      o.custom_adjustment.toFixed(2),
      o.total.toFixed(2),
      o.is_paid ? 'مدفوع' : 'غير مدفوع',
      translatePaymentMethod(o.payment_method),
      translateOrderStatus(o.status),
      new Date(o.created_at).toLocaleDateString('ar-SA')
    ]);
    
    const csvContent = "\uFEFF" + [
      [`التقرير المالي العام - مغسلة عود ونظافة`],
      [`الفترة من: ${financeFromDate || 'البداية'} إلى: ${financeToDate || 'اليوم'}`],
      [],
      [`ملخص الفترة:`],
      [`إجمالي المبيعات المحصلة, ${financeStats.totalRevenue.toFixed(2)} ر.س`],
      [`الضريبة المحصلة, ${financeStats.taxTotal.toFixed(2)} ر.س`],
      [`المبالغ المعلقة غير المحصلة, ${financeStats.pendingAmount.toFixed(2)} ر.س`],
      [`إجمالي عدد الطلبات, ${financeStats.totalOrdersCount}`],
      [],
      headers,
      ...rows
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `التقرير_المالي_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadGeneralPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('يرجى السماح بالنوافذ المنبثقة لتنزيل التقرير ⚠️');
    
    const fromStr = financeFromDate ? new Date(financeFromDate).toLocaleDateString('ar-SA') : 'البداية';
    const toStr = financeToDate ? new Date(financeToDate).toLocaleDateString('ar-SA') : 'اليوم';
    
    const translatePaymentMethod = (method: PaymentMethod) => {
      switch (method) {
        case 'Cash': return 'نقدي';
        case 'Card': return 'شبكة / مدى';
        case 'Transfer': return 'تحويل بنكي';
        case 'Subscription': return 'اشتراك';
        case 'Free': return 'طلب مجاني';
        default: return method;
      }
    };

    const htmlContent = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير الحسابات المالي</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #333;
            background-color: #fff;
          }
          .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 20px;
          }
          .header h1 {
            font-size: 28px;
            color: #1e1b4b;
            margin: 0;
          }
          .header p {
            font-size: 14px;
            color: #64748b;
            margin: 5px 0 0 0;
            font-weight: bold;
          }
          .info-grid {
            display: grid;
            grid-template-cols: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 40px;
          }
          .info-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            background-color: #f8fafc;
          }
          .info-card .title {
            font-size: 11px;
            color: #64748b;
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 8px;
          }
          .info-card .value {
            font-size: 24px;
            font-weight: 900;
          }
          .value.emerald { color: #059669; }
          .value.indigo { color: #4f46e5; }
          .value.red { color: #dc2626; }
          .payment-breakdown {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 40px;
            background-color: #fff;
          }
          .payment-breakdown h3 {
            margin: 0 0 15px 0;
            font-size: 16px;
            color: #1e1b4b;
          }
          .payment-grid {
            display: grid;
            grid-template-cols: repeat(3, 1fr);
            gap: 15px;
          }
          .payment-item {
            background-color: #f8fafc;
            padding: 12px;
            border-radius: 8px;
            text-align: center;
            font-size: 14px;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            padding: 12px 10px;
            text-align: right;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: bold;
          }
          tr:hover {
            background-color: #f8fafc;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>مغسلة عود ونظافة</h1>
          <p>التقرير المالي العام للفترة من ${fromStr} إلى ${toStr}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-card">
            <div class="title">المبيعات المحصلة</div>
            <div class="value emerald">${financeStats.totalRevenue.toFixed(2)} ر.س</div>
          </div>
          <div class="info-card">
            <div class="title">الضريبة المحصلة (15%)</div>
            <div class="value indigo">${financeStats.taxTotal.toFixed(2)} ر.س</div>
          </div>
          <div class="info-card">
            <div class="title">المبالغ المعلقة غير المحصلة</div>
            <div class="value red">${financeStats.pendingAmount.toFixed(2)} ر.س</div>
          </div>
        </div>

        <div class="payment-breakdown">
          <h3>طرق الدفع والتحصيل للفترة</h3>
          <div class="payment-grid">
            <div class="payment-item">نقدي: ${financeStats.cashRevenue.toFixed(2)} ر.س</div>
            <div class="payment-item">شبكة / مدى: ${financeStats.cardRevenue.toFixed(2)} ر.س</div>
            <div class="payment-item">تحويل بنكي: ${financeStats.transferRevenue.toFixed(2)} ر.س</div>
          </div>
        </div>

        <h3>قائمة تفاصيل مبيعات الطلبات (${filteredFinanceOrders.length} طلب)</h3>
        <table>
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>العميل</th>
              <th>الجوال</th>
              <th>نوع الطلب</th>
              <th>المجموع</th>
              <th>الضريبة</th>
              <th>الإجمالي</th>
              <th>حالة الدفع</th>
              <th>طريقة الدفع</th>
              <th>تاريخ الطلب</th>
            </tr>
          </thead>
          <tbody>
            ${filteredFinanceOrders.map(o => `
              <tr>
                <td><strong>${o.order_number}</strong></td>
                <td>${o.customer_name}</td>
                <td style="font-family: monospace;">${o.customer_phone}</td>
                <td>${o.order_type === 'Urgent' ? 'مستعجل' : 'عادي'}</td>
                <td>${o.subtotal.toFixed(2)} ر.س</td>
                <td>${o.tax.toFixed(2)} ر.س</td>
                <td><strong>${o.total.toFixed(2)} ر.س</strong></td>
                <td><span style="color: ${o.is_paid ? '#059669' : '#dc2626'}; font-weight: bold;">${o.is_paid ? 'مدفوع' : 'غير مدفوع'}</span></td>
                <td>${translatePaymentMethod(o.payment_method)}</td>
                <td>${new Date(o.created_at).toLocaleDateString('ar-SA')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          تم توليد هذا التقرير تلقائياً بتاريخ ${new Date().toLocaleString('ar-SA')} - مغسلة عود ونظافة
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const downloadCustomerExcel = (customerPhone: string, customerName: string) => {
    const customerOrders = orders.filter(o => o.customer_phone === customerPhone);
    
    const headers = [
      'رقم الطلب',
      'نوع الطلب',
      'الأصناف والتفاصيل',
      'المجموع الفرعي',
      'الضريبة (15%)',
      'خصم/تعديل',
      'الإجمالي',
      'حالة الدفع',
      'طريقة الدفع',
      'حالة الطلب',
      'تاريخ الطلب'
    ];
    
    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const translatePaymentMethod = (method: PaymentMethod) => {
      switch (method) {
        case 'Cash': return 'نقدي';
        case 'Card': return 'شبكة / مدى';
        case 'Transfer': return 'تحويل بنكي';
        case 'Subscription': return 'اشتراك';
        case 'Free': return 'طلب مجاني';
        default: return method;
      }
    };

    const translateOrderStatus = (status: OrderStatus) => {
      switch (status) {
        case 'Received': return 'تم الاستلام';
        case 'Washing': return 'جاري الغسيل';
        case 'Ironing': return 'جاري الكوي';
        case 'Ready': return 'جاهز للتسليم';
        case 'Delivered': return 'تم التسليم';
        default: return status;
      }
    };
    
    const getItemsSummaryString = (items: LaundryItem[]) => {
      if (!items || items.length === 0) return '-';
      return items.map(item => `${item.name} (${item.quantity})`).join(' - ');
    };
    
    const rows = customerOrders.map(o => [
      o.order_number,
      o.order_type === 'Urgent' ? 'مستعجل' : 'عادي',
      getItemsSummaryString(o.items),
      o.subtotal.toFixed(2),
      o.tax.toFixed(2),
      o.custom_adjustment.toFixed(2),
      o.total.toFixed(2),
      o.is_paid ? 'مدفوع' : 'غير مدفوع',
      translatePaymentMethod(o.payment_method),
      translateOrderStatus(o.status),
      new Date(o.created_at).toLocaleDateString('ar-SA')
    ]);
    
    const totalPaid = customerOrders.filter(o => o.is_paid).reduce((acc, o) => acc + o.total, 0);
    const totalPending = customerOrders.filter(o => !o.is_paid).reduce((acc, o) => acc + o.total, 0);
    
    const csvContent = "\uFEFF" + [
      [`كشف حساب العميل: ${customerName}`],
      [`رقم الجوال: ${customerPhone}`],
      [`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-SA')}`],
      [],
      [`ملخص المبيعات للعميل:`],
      [`إجمالي المدفوع المحصل, ${totalPaid.toFixed(2)} ر.س`],
      [`إجمالي المعلق غير المحصل, ${totalPending.toFixed(2)} ر.س`],
      [`إجمالي عدد الطلبات, ${customerOrders.length}`],
      [],
      headers,
      ...rows
    ].map(e => e.join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `كشف_حساب_${customerName}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCustomerPDF = (customerPhone: string, customerName: string) => {
    const customerOrders = orders.filter(o => o.customer_phone === customerPhone);
    const totalPaid = customerOrders.filter(o => o.is_paid).reduce((acc, o) => acc + o.total, 0);
    const totalPending = customerOrders.filter(o => !o.is_paid).reduce((acc, o) => acc + o.total, 0);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('يرجى السماح بالنوافذ المنبثقة لتنزيل التقرير ⚠️');
    
    const translatePaymentMethod = (method: PaymentMethod) => {
      switch (method) {
        case 'Cash': return 'نقدي';
        case 'Card': return 'شبكة / مدى';
        case 'Transfer': return 'تحويل بنكي';
        case 'Subscription': return 'اشتراك';
        case 'Free': return 'طلب مجاني';
        default: return method;
      }
    };

    const htmlContent = `
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف حساب العميل - ${customerName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 40px;
            color: #333;
            background-color: #fff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #4f46e5;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            font-size: 24px;
            color: #1e1b4b;
            margin: 0;
          }
          .header p {
            font-size: 14px;
            color: #64748b;
            margin: 5px 0 0 0;
          }
          .client-info {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
          }
          .client-info h3 {
            margin: 0 0 5px 0;
            color: #1e1b4b;
          }
          .client-info p {
            margin: 0;
            font-size: 13px;
            color: #475569;
          }
          .stats-grid {
            display: grid;
            grid-template-cols: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 35px;
          }
          .stat-card {
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 15px;
            text-align: center;
            background-color: #f8fafc;
          }
          .stat-card .title {
            font-size: 11px;
            color: #64748b;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .stat-card .val {
            font-size: 20px;
            font-weight: 900;
          }
          .val.green { color: #059669; }
          .val.red { color: #dc2626; }
          .val.indigo { color: #4f46e5; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            padding: 10px;
            text-align: right;
          }
          th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: bold;
          }
          .items-list {
            font-size: 10px;
            color: #64748b;
            line-height: 1.4;
          }
          .footer {
            margin-top: 50px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>مغسلة عود ونظافة</h1>
            <p>كشف حساب العمليات والطلبات التفصيلي</p>
          </div>
          <div style="text-align: left;">
            <p style="font-weight: bold;">تاريخ الطباعة</p>
            <p>${new Date().toLocaleDateString('ar-SA')}</p>
          </div>
        </div>

        <div class="client-info">
          <div>
            <h3>العميل: ${customerName}</h3>
            <p>رقم الجوال: <span style="font-family: monospace;">${customerPhone}</span></p>
          </div>
          <div style="text-align: left;">
            <p>حالة العميل: نشط</p>
            <p>إجمالي المعاملات: ${customerOrders.length} طلب</p>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="title">إجمالي المبالغ المدفوعة</div>
            <div class="val green">${totalPaid.toFixed(2)} ر.س</div>
          </div>
          <div class="stat-card">
            <div class="title">إجمالي المبالغ المعلقة</div>
            <div class="val red">${totalPending.toFixed(2)} ر.س</div>
          </div>
          <div class="stat-card">
            <div class="title">عدد الطلبات</div>
            <div class="val indigo">${customerOrders.length}</div>
          </div>
        </div>

        <h3>تفاصيل الطلبات المسجلة للعميل</h3>
        <table>
          <thead>
            <tr>
              <th>رقم الطلب</th>
              <th>نوع الطلب</th>
              <th>الأصناف والتفاصيل</th>
              <th>المجموع</th>
              <th>الضريبة</th>
              <th>خصم/تعديل</th>
              <th>الإجمالي</th>
              <th>حالة الدفع</th>
              <th>طريقة الدفع</th>
              <th>التاريخ والوقت</th>
            </tr>
          </thead>
          <tbody>
            ${customerOrders.map(o => `
              <tr>
                <td><strong>${o.order_number}</strong></td>
                <td>${o.order_type === 'Urgent' ? 'مستعجل' : 'عادي'}</td>
                <td class="items-list">${o.items.map(item => `${item.name} (${item.quantity})`).join('، ')}</td>
                <td>${o.subtotal.toFixed(2)} ر.س</td>
                <td>${o.tax.toFixed(2)} ر.س</td>
                <td>${o.custom_adjustment.toFixed(2)} ر.س</td>
                <td><strong>${o.total.toFixed(2)} ر.س</strong></td>
                <td><span style="color: ${o.is_paid ? '#059669' : '#dc2626'}; font-weight: bold;">${o.is_paid ? 'مدفوع' : 'غير مدفوع'}</span></td>
                <td>${translatePaymentMethod(o.payment_method)}</td>
                <td>${new Date(o.created_at).toLocaleDateString('ar-SA')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          كشف الحساب هذا تم توليده إلكترونياً لعميل مغسلة عود ونظافة
        </div>
        
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleAssignSubscription = async (pkgId: string) => {
    if (!showAssignSubModal) return;
    const pkg = subscriptionPackages.find(p => p.id === pkgId);
    if (!pkg) return;

    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
    const expiryIso = safeAddDaysISO(pkg.duration_days);

    const subId = generateUUID();
    const newSub: any = {
      id: subId,
      customer_name: isDbMultiTenant ? showAssignSubModal.name : `${laundryId}|${showAssignSubModal.name}`,
      customer_phone: isDbMultiTenant ? showAssignSubModal.phone : `${laundryId}|${showAssignSubModal.phone}`,
      package_id: pkg.id,
      items_remaining: pkg.total_items,
      total_items: pkg.total_items,
      expiry_date: expiryIso,
      is_active: true
    };
    if (laundryId) {
      newSub.laundry_id = laundryId;
    }

    try {
      const { error } = await supabase.from('subscriptions').insert([newSub]);
      if (error) throw error;
      
      const localSub = {
        ...newSub,
        customer_name: cleanTenantString(newSub.customer_name),
        customer_phone: cleanTenantString(newSub.customer_phone)
      };
      setSubscriptions(prev => [localSub, ...prev]);
      if (showEditOrderModal) {
        setEditedSubscription(localSub);
        setShowEditOrderModal(prev => prev ? ({
          ...prev,
          payment_method: 'Subscription',
          is_paid: true
        }) : null);
      }
      setShowAssignSubModal(null);
      alert(`تم تفعيل اشتراك ${pkg.name} للعميل بنجاح ✅`);
    } catch (e: any) {
      alert(`فشل تفعيل الاشتراك: ${e.message}`);
    }
  };

  const updateSubscriptionBalance = async (subId: string, newBalance: number) => {
    const safeBalance = Math.max(0, newBalance);
    try {
      const { error } = await supabase.from('subscriptions').update({ items_remaining: safeBalance }).eq('id', subId);
      if (error) throw error;
      setSubscriptions(prev => prev.map(s => 
        s.id === subId ? { ...s, items_remaining: safeBalance } : s
      ));
    } catch (e: any) {
      console.error("Failed to update balance in DB:", e);
    }
  };

  const deleteCategory = async (target: { id?: string; name: string } | string) => {
    const targetId = typeof target === 'string' ? target : target?.id;
    const targetName = typeof target === 'string' ? target : target?.name;

    if (isDeletingCategoryRef.current) return;
    isDeletingCategoryRef.current = true;
    setIsDeletingCategory(true);

    console.log("Deleting category:", { targetId, targetName });

    try {
      if (targetId) {
        console.log(`Executing Supabase delete for id: ${targetId} ...`);
        const { error } = await supabase
          .from('categories')
          .delete()
          .eq('id', targetId);
        
        if (error) {
          console.error("Supabase delete error details:", error);
        }
      }

      if (targetName) {
        try {
          const updatedPrices = { ...customPrices };
          delete updatedPrices[targetName];
          setCustomPrices(updatedPrices);
          localStorage.setItem('laundry_categories_custom_prices', JSON.stringify(updatedPrices));
          await syncCustomPricesToDb(updatedPrices);
        } catch (e) {
          console.error("Failed to delete custom prices from settings:", e);
        }

        try {
          const storedIconsStr = localStorage.getItem('laundry_categories_custom_icons') || '{}';
          const storedIcons = JSON.parse(storedIconsStr);
          delete storedIcons[targetName];
          localStorage.setItem('laundry_categories_custom_icons', JSON.stringify(storedIcons));
        } catch (e) {
          console.error("Failed to delete custom icon:", e);
        }

        try {
          const updatedCons = { ...inventoryConsumption };
          delete updatedCons[targetName];
          setInventoryConsumption(updatedCons);
          localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updatedCons));
          await syncInventoryConsumptionToDb(updatedCons);
        } catch (e) {
          console.error("Failed to delete custom inventory consumption:", e);
        }
      }

      setCategories(prev => {
        return prev.filter(c => {
          if (targetId && (c as any).id === targetId) return false;
          if (targetName && c.name === targetName) return false;
          return true;
        });
      });

      alert('تم حذف الصنف بنجاح ✅');
    } catch (e: any) {
      console.error("Delete category exception caught:", e);
      alert(`فشل الحذف: ${e.message || 'خطأ غير معروف'}`);
    } finally {
      isDeletingCategoryRef.current = false;
      setIsDeletingCategory(false);
    }
  };

  const [useSubscription, setUseSubscription] = useState<boolean>(true);
  const [selectedOrderPackageId, setSelectedOrderPackageId] = useState<string>('');

  const [newOrder, setNewOrder] = useState<{
    customer_name: string;
    customer_phone: string;
    order_type: OrderType;
    items: LaundryItem[];
    is_paid: boolean;
    payment_method: PaymentMethod;
    custom_adjustment: number;
    is_free: boolean;
    is_tax_enabled: boolean;
    discount_percent: number;
  }>({
    customer_name: '',
    customer_phone: '',
    order_type: 'Normal',
    items: [],
    is_paid: false,
    payment_method: 'Cash',
    custom_adjustment: 0,
    is_free: false,
    is_tax_enabled: true,
    discount_percent: 0
  });

  // Auto-select subscription and apply automatic package discount if available
  useEffect(() => {
    if (newOrder.customer_phone.length >= 9) {
      const sub = getCustomerSubscription(newOrder.customer_phone);
      const activePkgId = sub ? sub.package_id : selectedOrderPackageId;
      const pkg = activePkgId ? subscriptionPackages.find(p => p.id === activePkgId) : null;
      const hasSubOrNewPkg = !!sub || !!selectedOrderPackageId;
      const autoDiscount = (hasSubOrNewPkg && useSubscription && pkg && pkg.discount_percent) ? pkg.discount_percent : 0;

      setNewOrder(prev => {
        let updated = false;
        const updates: any = {};
        
        if (hasSubOrNewPkg && useSubscription) {
          if (!prev.is_free && prev.payment_method !== 'Subscription') {
            updates.is_paid = true;
            updates.payment_method = 'Subscription';
            updated = true;
          }
        } else {
          // If customer has a subscription but use_subscription is toggled OFF, reset payment method from 'Subscription' to 'Cash'
          if (prev.payment_method === 'Subscription') {
            updates.is_paid = false;
            updates.payment_method = 'Cash';
            updated = true;
          }
        }
        
        if (prev.discount_percent !== autoDiscount) {
          updates.discount_percent = autoDiscount;
          updated = true;
        }

        if (updated) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    } else {
      // Clear auto-applied discount if phone number is cleared
      setNewOrder(prev => {
        if (prev.discount_percent > 0 || prev.payment_method === 'Subscription') {
          return { ...prev, discount_percent: 0, payment_method: 'Cash', is_paid: false };
        }
        return prev;
      });
    }
  }, [newOrder.customer_phone, useSubscription, selectedOrderPackageId, subscriptions, subscriptionPackages]);

  const currentSubtotal = useMemo(() => {
    if (newOrder.is_free) return 0;
    const itemsTotal = newOrder.items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const sub = itemsTotal + (newOrder.custom_adjustment || 0);
    const discount = sub * ((newOrder.discount_percent || 0) / 100);
    return Math.max(0, sub - discount);
  }, [newOrder.items, newOrder.custom_adjustment, newOrder.is_free, newOrder.discount_percent]);

  const currentTax = useMemo(() => newOrder.is_tax_enabled ? currentSubtotal * TAX_RATE : 0, [currentSubtotal, newOrder.is_tax_enabled]);
  const currentTotal = useMemo(() => currentSubtotal + currentTax, [currentSubtotal, currentTax]);

  const togglePredefinedItem = (item: { name: string, price: number }) => {
    if (isEditingPrices) return;

    // Prevent duplicate item additions from rapid double-clicks within 300ms
    const now = Date.now();
    if (lastItemAddClickTimeRef.current.name === item.name && now - lastItemAddClickTimeRef.current.time < 300) {
      return;
    }
    lastItemAddClickTimeRef.current = { name: item.name, time: now };

    const id = Math.random().toString(36).substr(2, 9);
    const prices = getItemPrices(item);
    const normal = prices.price_normal;
    const urgent = prices.price_urgent;
    const ironing = prices.price_ironing;
    const noIron = prices.price_no_ironing;
    setNewOrder(prev => ({
      ...prev,
      items: [...prev.items, { 
        id, 
        name: item.name, 
        quantity: 1, 
        price: item.price, 
        service_type: undefined, 
        is_ironing_only: false,
        ironing_type: undefined,
        is_urgent: false,
        is_no_ironing: false,
        price_normal: normal,
        price_urgent: urgent,
        price_ironing: ironing,
        price_no_ironing: noIron,
        base_price: item.price,
        is_normal: false
      }]
    }));
  };

  const handleAddCustomItem = async () => {
    if (isAddingCustomItemRef.current) return;

    if (!customItemForm.name || customItemForm.price < 0 || customItemForm.price_normal < 0 || customItemForm.price_urgent < 0 || customItemForm.price_ironing < 0 || customItemForm.price_no_ironing < 0) {
      return alert('يرجى إدخال اسم صحيح وأسعار لا تقل عن الصفر');
    }

    isAddingCustomItemRef.current = true;
    setIsAddingCustomItem(true);
    
    const rawLaundryId = userProfile?.laundry_id || 'laund-unknown';
    const laundryId = ensureUUID(rawLaundryId);
    const chosenIcon = customItemForm.icon && customItemForm.icon.trim() ? customItemForm.icon.trim() : '✨';

    try {
      const catName = isDbMultiTenant ? customItemForm.name : `${rawLaundryId}|${customItemForm.name}`;
      const newCat: any = {
        name: catName,
        price: customItemForm.price,
        icon: chosenIcon
      };
      if (laundryId) {
        newCat.laundry_id = laundryId;
      }
      
      let result;
      try {
        const fullCat: any = {
          ...newCat,
          price_normal: customItemForm.price_normal,
          price_urgent: customItemForm.price_urgent,
          price_ironing: customItemForm.price_ironing,
          price_no_ironing: customItemForm.price_no_ironing
        };
        if (laundryId) {
          fullCat.laundry_id = laundryId;
        }
        const { data, error } = await supabase.from('categories').insert([fullCat]).select();
        if (error) {
          console.warn("Categories custom columns missing, falling back to basic insert.");
          const { data: fallbackData, error: fallbackError } = await supabase.from('categories').insert([newCat]).select();
          if (fallbackError) throw fallbackError;
          result = fallbackData;
        } else {
          result = data;
        }
      } catch (insertErr) {
        console.warn("Failed inserting custom columns, using standard insert fallback:", insertErr);
        const { data: fallbackData, error: fallbackError } = await supabase.from('categories').insert([newCat]).select();
        if (fallbackError) throw fallbackError;
        result = fallbackData;
      }
      
      const returnedRow = result && result.length > 0 ? result[0] : { id: Math.random().toString(36).substr(2, 9) };
      const savedCat = {
        ...returnedRow,
        id: returnedRow.id,
        name: customItemForm.name,
        price: customItemForm.price,
        icon: chosenIcon,
        price_normal: customItemForm.price_normal,
        price_urgent: customItemForm.price_urgent,
        price_ironing: customItemForm.price_ironing,
        price_no_ironing: customItemForm.price_no_ironing
      };

      // Save to state, localStorage, and clean-sync with Supabase settings
      try {
        const storedPrices = { ...customPrices };
        storedPrices[savedCat.name] = {
          price_normal: savedCat.price_normal,
          price_urgent: savedCat.price_urgent,
          price_ironing: savedCat.price_ironing,
          price_no_ironing: savedCat.price_no_ironing
        };
        setCustomPrices(storedPrices);
        localStorage.setItem('laundry_categories_custom_prices', JSON.stringify(storedPrices));
        await syncCustomPricesToDb(storedPrices);
      } catch (e) {
        console.error("Failed to save custom prices map:", e);
      }

      // Save custom item inventory consumptions if any
      try {
        const storedCons = { ...inventoryConsumption };
        storedCons[savedCat.name] = customItemConsumptions;
        setInventoryConsumption(storedCons);
        localStorage.setItem('laundry_inventory_consumption', JSON.stringify(storedCons));
        await syncInventoryConsumptionToDb(storedCons);
      } catch (e) {
        console.error("Failed to save custom inventory consumptions map:", e);
      }
      
      setCategories(prev => {
        const isUsingFallback = prev.length > 0 && !(prev[0] as any).id;
        if (isUsingFallback) {
          return [savedCat];
        }
        return [...prev, savedCat];
      });
      
      // Add custom item with all 4 default prices to current order
      setNewOrder(prev => ({
        ...prev,
        items: [...prev.items, { 
          id: savedCat.id, 
          name: savedCat.name, 
          quantity: 1, 
          price: customItemForm.price, 
          service_type: undefined, 
          is_ironing_only: false,
          ironing_type: undefined,
          is_urgent: false,
          is_no_ironing: false,
          price_normal: customItemForm.price_normal,
          price_urgent: customItemForm.price_urgent,
          price_ironing: customItemForm.price_ironing,
          price_no_ironing: customItemForm.price_no_ironing,
          base_price: customItemForm.price,
          is_normal: false
        }]
      }));

      setCustomItemForm({ name: '', price: 0, price_normal: 0, price_urgent: 0, price_ironing: 0, price_no_ironing: 0, icon: '✨' });
      setCustomItemConsumptions({});
      setShowCustomItemModal(false);
    } catch (e: any) {
      alert(`فشل إضافة الصنف: ${e.message}`);
    } finally {
      isAddingCustomItemRef.current = false;
      setIsAddingCustomItem(false);
    }
  };

  const updateCategoryIcon = async (index: number, newIcon: string) => {
    const item = categories[index];
    const updated = [...categories];
    updated[index].icon = newIcon;
    setCategories(updated);

    // Save custom icon to localStorage for persistent default categories
    try {
      const storedIconsStr = localStorage.getItem('laundry_categories_custom_icons') || '{}';
      const storedIcons = JSON.parse(storedIconsStr);
      storedIcons[item.name] = newIcon;
      localStorage.setItem('laundry_categories_custom_icons', JSON.stringify(storedIcons));
    } catch (e) {
      console.error("Failed to save icon locally:", e);
    }

    if ((item as any).id) {
      try {
        await supabase.from('categories').update({ icon: newIcon }).eq('id', (item as any).id);
      } catch (e) {
        console.error(`Failed to update icon in DB:`, e);
      }
    }
  };

  const updateCategoryCustomPrice = async (index: number, field: 'price' | 'price_urgent' | 'price_ironing' | 'price_no_ironing', newPrice: number) => {
    const item = categories[index];
    const updated = [...categories];
    const mappedField = field === 'price' ? 'price_normal' : field;
    updated[index][mappedField] = newPrice;
    if (mappedField === 'price_normal') {
      updated[index]['price'] = newPrice;
    }

    const normal = updated[index].price_normal !== undefined ? updated[index].price_normal : updated[index].price;
    if (updated[index].price_urgent === undefined) updated[index].price_urgent = normal * 2;
    if (updated[index].price_ironing === undefined) updated[index].price_ironing = normal * 0.5;
    if (updated[index].price_no_ironing === undefined) updated[index].price_no_ironing = normal * 0.8;

    setCategories(updated);
    
    // Save to state, localStorage, and sync to Supabase settings
    try {
      const storedPrices = { ...customPrices };
      storedPrices[item.name] = {
        price_normal: updated[index].price_normal,
        price_urgent: updated[index].price_urgent,
        price_ironing: updated[index].price_ironing,
        price_no_ironing: updated[index].price_no_ironing
      };
      setCustomPrices(storedPrices);
      localStorage.setItem('laundry_categories_custom_prices', JSON.stringify(storedPrices));
      await syncCustomPricesToDb(storedPrices);
    } catch (e) {
      console.error("Failed to save custom price:", e);
    }

    if ((item as any).id) {
      try {
        await supabase.from('categories').update({ [field]: newPrice }).eq('id', (item as any).id);
      } catch (e) {
        console.error(`Failed to update ${field} in DB:`, e);
      }
    }
  };

  const openEditCategoryModal = (idx: number) => {
    const item = categories[idx];
    if (!item) return;
    const prices = getItemPrices(item);
    setEditingCategoryModalIndex(idx);
    setEditingCategoryForm({
      id: (item as any).id,
      name: item.name,
      icon: item.icon || '✨',
      price: item.price || prices.price_normal,
      price_normal: prices.price_normal,
      price_urgent: prices.price_urgent,
      price_ironing: prices.price_ironing,
    });

    const existingMap = inventoryConsumption[item.name] || {};
    setEditingCategoryConsumptions({ ...existingMap });
    setShowEditCategoryIconPicker(false);
    setShowDeleteCategoryConfirm(false);
  };

  const handleSaveCategoryEdit = async () => {
    if (editingCategoryModalIndex === null) return;
    if (isSavingCategoryRef.current) return;

    isSavingCategoryRef.current = true;
    setIsSavingCategory(true);

    try {
      const oldItem = categories[editingCategoryModalIndex];
      if (!oldItem) return;
      const oldName = oldItem.name;
      const newName = editingCategoryForm.name.trim() || oldName;
      const newIcon = editingCategoryForm.icon.trim() || '✨';
      const newNormal = editingCategoryForm.price_normal;
      const newUrgent = editingCategoryForm.price_urgent;
      const newIroning = editingCategoryForm.price_ironing;

      // 1. Update categories array
      const updatedCategories = [...categories];
      updatedCategories[editingCategoryModalIndex] = {
        ...updatedCategories[editingCategoryModalIndex],
        name: newName,
        icon: newIcon,
        price: newNormal,
        price_normal: newNormal,
        price_urgent: newUrgent,
        price_ironing: newIroning,
      };
      setCategories(updatedCategories);

      // 2. Update custom prices state and storage
      const storedPrices = { ...customPrices };
      if (oldName !== newName) {
        delete storedPrices[oldName];
      }
      storedPrices[newName] = {
        price_normal: newNormal,
        price_urgent: newUrgent,
        price_ironing: newIroning,
        price_no_ironing: newNormal * 0.8,
      };
      setCustomPrices(storedPrices);
      try {
        localStorage.setItem('laundry_categories_custom_prices', JSON.stringify(storedPrices));
        await syncCustomPricesToDb(storedPrices);
      } catch (e) {
        console.error("Failed to save custom prices:", e);
      }

      // 3. Save custom icon locally
      try {
        const storedIconsStr = localStorage.getItem('laundry_categories_custom_icons') || '{}';
        const storedIcons = JSON.parse(storedIconsStr);
        if (oldName !== newName) delete storedIcons[oldName];
        storedIcons[newName] = newIcon;
        localStorage.setItem('laundry_categories_custom_icons', JSON.stringify(storedIcons));
      } catch (e) {
        console.error("Failed to save custom icon:", e);
      }

      // 4. Save material consumption
      const updatedInvConsumption = { ...inventoryConsumption };
      if (oldName !== newName) {
        delete updatedInvConsumption[oldName];
      }
      updatedInvConsumption[newName] = editingCategoryConsumptions;
      setInventoryConsumption(updatedInvConsumption);
      try {
        localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updatedInvConsumption));
        await syncInventoryConsumptionToDb(updatedInvConsumption);
      } catch (e) {
        console.error("Failed to save inventory consumption:", e);
      }

      // 5. Update category in Supabase DB if ID exists
      if (editingCategoryForm.id) {
        try {
          await supabase.from('categories').update({
            name: newName,
            icon: newIcon,
            price: newNormal,
            price_normal: newNormal,
            price_urgent: newUrgent,
            price_ironing: newIroning,
          }).eq('id', editingCategoryForm.id);
        } catch (e) {
          console.error("Failed to update category in Supabase:", e);
        }
      }

      setEditingCategoryModalIndex(null);
    } finally {
      isSavingCategoryRef.current = false;
      setIsSavingCategory(false);
    }
  };

  const updateItemQuantity = (id: string, delta: number) => {
    setNewOrder(prev => {
      if (delta > 0) {
        const itemToCopy = prev.items.find(i => i.id === id);
        if (itemToCopy) {
          const newId = Math.random().toString(36).substr(2, 9);
          const duplicated = { ...itemToCopy, id: newId, quantity: 1 };
          return {
            ...prev,
            items: [...prev.items, duplicated]
          };
        }
      }
      return {
        ...prev,
        items: prev.items.filter(i => i.id !== id)
      };
    });
  };

  const getBaseItemPrice = (name: string): number => {
    const matchedCategory = categories.find(c => c.name === name);
    if (matchedCategory) return matchedCategory.price;
    const matchedInitial = INITIAL_ITEMS.find(i => i.name === name);
    if (matchedInitial) return matchedInitial.price;
    return 5;
  };

  const getItemPrices = (itemOrName: any) => {
    let name = typeof itemOrName === 'string' ? itemOrName : itemOrName.name;
    let basePrice = typeof itemOrName === 'string' ? getBaseItemPrice(name) : (itemOrName.price ?? itemOrName.price_normal ?? 5);

    // Prefer React customPrices state; falls back to localStorage if empty
    let custom: any = {};
    if (Object.keys(customPrices).length > 0) {
      custom = customPrices[name] || {};
    } else {
      try {
        const stored = localStorage.getItem('laundry_categories_custom_prices');
        if (stored) {
          const storedPrices = JSON.parse(stored);
          custom = storedPrices[name] || {};
        }
      } catch (e) {
        console.warn("localStorage error in getItemPrices:", e);
      }
    }

    // fallback structure
    const price_normal = custom.price_normal !== undefined && custom.price_normal !== null
      ? custom.price_normal
      : (typeof itemOrName === 'object' && itemOrName && itemOrName.price_normal !== undefined && itemOrName.price_normal !== null
          ? itemOrName.price_normal
          : basePrice);

    const price_urgent = custom.price_urgent !== undefined && custom.price_urgent !== null
      ? custom.price_urgent
      : (typeof itemOrName === 'object' && itemOrName && itemOrName.price_urgent !== undefined && itemOrName.price_urgent !== null
          ? itemOrName.price_urgent
          : price_normal * 2);

    const price_ironing = custom.price_ironing !== undefined && custom.price_ironing !== null
      ? custom.price_ironing
      : (typeof itemOrName === 'object' && itemOrName && itemOrName.price_ironing !== undefined && itemOrName.price_ironing !== null
          ? itemOrName.price_ironing
          : price_normal * 0.5);

    const price_no_ironing = custom.price_no_ironing !== undefined && custom.price_no_ironing !== null
      ? custom.price_no_ironing
      : (typeof itemOrName === 'object' && itemOrName && itemOrName.price_no_ironing !== undefined && itemOrName.price_no_ironing !== null
          ? itemOrName.price_no_ironing
          : price_normal * 0.8);

    return {
      price_normal,
      price_urgent,
      price_ironing,
      price_no_ironing
    };
  };

  const updateItemOption = (id: string, option: 'urgent' | 'ironing' | 'no_ironing' | 'normal', enabled: boolean) => {
    setNewOrder(prev => {
      const updatedItems = prev.items.map(i => {
        if (i.id === id) {
          const prices = getItemPrices(i);
          const normal = prices.price_normal;
          const urgent = prices.price_urgent;
          const ironing = prices.price_ironing;
          const noIron = prices.price_no_ironing;

          const basePrice = i.base_price !== undefined ? i.base_price : (i.price ?? 5);

          const is_normal = option === 'normal' ? enabled : (i.is_normal || false);
          const is_urgent = option === 'urgent' ? enabled : (i.is_urgent || false);
          const is_ironing_only = option === 'ironing' ? enabled : (i.is_ironing_only || false);
          const is_no_ironing = option === 'no_ironing' ? enabled : (i.is_no_ironing || false);

          let finalPrice = basePrice;
          if (is_normal) {
            finalPrice += normal;
          }
          if (is_urgent) {
            finalPrice += urgent;
          }
          if (is_ironing_only) {
            finalPrice += ironing;
          }
          if (is_no_ironing) {
            finalPrice += noIron;
          }

          return {
            ...i,
            price_normal: normal,
            price_urgent: urgent,
            price_ironing: ironing,
            price_no_ironing: noIron,
            is_normal,
            is_urgent,
            is_ironing_only,
            is_no_ironing,
            service_type: is_urgent ? 'مستعجل' : (is_normal ? 'عادي' : undefined),
            ironing_type: is_ironing_only ? 'كوي' : (is_no_ironing ? 'بدون كوي' : undefined),
            price: finalPrice,
            base_price: basePrice
          };
        }
        return i;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const updateItemMode = (id: string, mode: 'عادي' | 'مستعجل' | 'كوي' | 'بدون كوي') => {
    const item = newOrder.items.find(i => i.id === id);
    if (!item) return;

    if (mode === 'عادي') {
      const isNormal = item.is_normal || false;
      updateItemOption(id, 'normal', !isNormal);
    } else if (mode === 'مستعجل') {
      const isUrgent = item.is_urgent || item.service_type === 'مستعجل' || false;
      updateItemOption(id, 'urgent', !isUrgent);
    } else if (mode === 'كوي') {
      const isIroning = item.is_ironing_only || false;
      updateItemOption(id, 'ironing', !isIroning);
    } else if (mode === 'بدون كوي') {
      const isNoIron = item.is_no_ironing || false;
      updateItemOption(id, 'no_ironing', !isNoIron);
    }
  };

  const updateItemCustomPrice = (id: string, type: 'normal' | 'urgent' | 'ironing' | 'no_ironing', priceValue: number) => {
    setNewOrder(prev => {
      const updatedItems = prev.items.map(i => {
        if (i.id === id) {
          const prices = getItemPrices(i);
          const normal = prices.price_normal;
          const urgent = prices.price_urgent;
          const ironing = prices.price_ironing;
          const noIron = prices.price_no_ironing;

          const updatedPrices = {
            price_normal: type === 'normal' ? priceValue : normal,
            price_urgent: type === 'urgent' ? priceValue : urgent,
            price_ironing: type === 'ironing' ? priceValue : ironing,
            price_no_ironing: type === 'no_ironing' ? priceValue : noIron
          };

          const is_normal = i.is_normal || false;
          const is_urgent = i.is_urgent || false;
          const is_ironing_only = i.is_ironing_only || false;
          const is_no_ironing = i.is_no_ironing || false;

          const basePrice = i.base_price !== undefined ? i.base_price : (i.price ?? 5);

          let activePrice = basePrice;
          if (is_normal) {
            activePrice += updatedPrices.price_normal;
          }
          if (is_urgent) {
            activePrice += updatedPrices.price_urgent;
          }
          if (is_ironing_only) {
            activePrice += updatedPrices.price_ironing;
          }
          if (is_no_ironing) {
            activePrice += updatedPrices.price_no_ironing;
          }

          return {
            ...i,
            ...updatedPrices,
            price: activePrice
          };
        }
        return i;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const updateItemServiceType = (id: string, service_type: 'عادي' | 'مستعجل') => {
    updateItemOption(id, 'urgent', service_type === 'مستعجل');
  };

  const updateItemIroningOnly = (id: string, is_ironing_only: boolean) => {
    updateItemOption(id, 'ironing', is_ironing_only);
  };

  const updateItemPrice = (id: string, price: number) => {
    setNewOrder(prev => {
      const updatedItems = prev.items.map(i => {
        if (i.id === id) {
          // Update the normal price as the primary target
          return { 
            ...i, 
            price, 
            price_normal: price 
          };
        }
        return i;
      });
      return { ...prev, items: updatedItems };
    });
  };

  const handleCreateOrder = async () => {
    if (!newOrder.customer_name || !newOrder.customer_phone) return alert('يرجى إدخال اسم العميل ورقم هاتفه');
    if (newOrder.items.length === 0 && newOrder.custom_adjustment === 0) return alert('يرجى إضافة قطعة واحدة على الأقل');
    
    if (isSubmittingOrderRef.current) {
      console.warn("Order submission already in progress. Ignoring duplicate click.");
      return;
    }
    isSubmittingOrderRef.current = true;
    setLoading(true);
    const nowISO = new Date().toISOString();
    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
    
    try {
      let activeSubId: string | undefined = undefined;
      let activeSubRemaining: number = 0;

      const existingSub = getCustomerSubscription(newOrder.customer_phone);
      if (existingSub) {
        activeSubId = existingSub.id;
        activeSubRemaining = existingSub.items_remaining;
      }

      // Create subscription first if a subscription package is selected and customer has no active sub
      if (selectedOrderPackageId) {
        const pkg = subscriptionPackages.find(p => p.id === selectedOrderPackageId);
        if (pkg) {
          const expiryIso = safeAddDaysISO(pkg.duration_days);

          const subId = generateUUID();
          const newSub: any = {
            id: subId,
            customer_name: isDbMultiTenant ? newOrder.customer_name : `${laundryId}|${newOrder.customer_name}`,
            customer_phone: isDbMultiTenant ? newOrder.customer_phone : `${laundryId}|${newOrder.customer_phone}`,
            package_id: pkg.id,
            items_remaining: pkg.total_items,
            total_items: pkg.total_items,
            expiry_date: expiryIso,
            is_active: true
          };
          if (isDbMultiTenant) {
            newSub.laundry_id = laundryId;
          }

          const { error: subErr } = await supabase.from('subscriptions').insert([newSub]);
          if (subErr) throw subErr;

          activeSubId = newSub.id;
          activeSubRemaining = newSub.total_items;

          // Add to local subscriptions state
          const localSub = {
            ...newSub,
            customer_name: cleanTenantString(newSub.customer_name),
            customer_phone: cleanTenantString(newSub.customer_phone)
          };
          setSubscriptions(prev => [localSub, ...prev]);
        }
      }

      const rawOrderNumber = `ORD-${Date.now().toString().slice(-5)}`;
      const orderData: any = {
        order_number: isDbMultiTenant ? rawOrderNumber : `${laundryId}-${rawOrderNumber}`,
        customer_name: isDbMultiTenant ? newOrder.customer_name : `${laundryId}|${newOrder.customer_name}`,
        customer_phone: isDbMultiTenant ? newOrder.customer_phone : `${laundryId}|${newOrder.customer_phone}`,
        order_type: newOrder.order_type,
        items: newOrder.items.map(item => ({
          ...item,
          discount_percent: newOrder.discount_percent
        })),
        subtotal: currentSubtotal,
        tax: currentTax,
        total: currentTotal,
        custom_adjustment: newOrder.custom_adjustment,
        is_paid: newOrder.is_paid || newOrder.is_free,
        payment_method: newOrder.is_free ? 'Free' : newOrder.payment_method,
        status: 'Received',
        created_at: nowISO,
        updated_at: nowISO
      };
      if (isDbMultiTenant) {
        orderData.laundry_id = laundryId;
      }

      const creatorEmail = userProfile?.email || session?.user?.email || 'unspecified';

      let data, error;
      try {
        const res = await supabase.from('orders').insert([{ ...orderData, created_by: creatorEmail }]).select();
        data = res.data;
        error = res.error;
        if (error && (error.message?.includes('column') || error.code === '42703')) {
          // Fallback if postgres column 'created_by' is missing
          console.warn("created_by column missing from Supabase orders table, using fallback insert.");
          const resFallback = await supabase.from('orders').insert([orderData]).select();
          data = resFallback.data;
          error = resFallback.error;
        }
      } catch (insertErr) {
        console.warn("First insert attempt failed, trying fallback standard insert:", insertErr);
        const resFallback = await supabase.from('orders').insert([orderData]).select();
        data = resFallback.data;
        error = resFallback.error;
      }

      if (error) throw error;
      
      if (data && data.length > 0) {
        const createdOrder = {
          ...data[0],
          order_number: cleanTenantString(data[0].order_number),
          customer_name: cleanTenantString(data[0].customer_name),
          customer_phone: cleanTenantString(data[0].customer_phone)
        };
        
        // Deduct from subscription if applicable (Only if payment method is explicitly 'Subscription')
        const orderPaymentMethod = newOrder.is_free ? 'Free' : newOrder.payment_method;
        if (activeSubId && orderPaymentMethod === 'Subscription') {
          const totalItemsInOrder = newOrder.items.reduce((acc, i) => acc + i.quantity, 0);
          if (totalItemsInOrder > 0) {
            await updateSubscriptionBalance(activeSubId, activeSubRemaining - totalItemsInOrder);
          }
        }

        // Deduct consumed materials from inventory
        try {
          const totalInventoryCuts: Record<string, number> = {};
          newOrder.items.forEach(laundryItem => {
            const consumption = inventoryConsumption[laundryItem.name];
            if (consumption) {
              const qty = laundryItem.quantity || 1;
              Object.entries(consumption).forEach(([invId, rate]) => {
                const numericRate = parseFloat(rate as any) || 0;
                if (numericRate > 0) {
                  totalInventoryCuts[invId] = (totalInventoryCuts[invId] || 0) + (numericRate * qty);
                }
              });
            }
          });

          const updatedInventory = [...inventory];
          for (const [invId, cutQty] of Object.entries(totalInventoryCuts)) {
            const invItem = updatedInventory.find(i => i.id === invId);
            if (invItem) {
              const newStock = Math.max(0, invItem.stock - cutQty);
              // Update in database
              await supabase.from('inventory').update({ stock: newStock }).eq('id', invId);
              // Update in local state
              invItem.stock = newStock;
            }
          }
          setInventory(updatedInventory);
        } catch (invErr) {
          console.error("Failed to deduct inventory consumption:", invErr);
        }

        setOrders(prev => [createdOrder, ...prev]);
        setNewOrder({ customer_name: '', customer_phone: '', order_type: 'Normal', items: [], is_paid: false, payment_method: 'Cash', custom_adjustment: 0, is_free: false, is_tax_enabled: true, discount_percent: 0 });
        setUseSubscription(true);
        setSelectedOrderPackageId('');
        setActiveTab('orders');
        handlePrintNewPage(createdOrder);

        // Auto msg
        triggerBackgroundNotification(createdOrder, 'RECEIVED');
      }
    } catch (e: any) {
      alert(`فشل الحفظ: ${e.message}`);
    } finally { 
      setLoading(false); 
      isSubmittingOrderRef.current = false;
    }
  };

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    try {
      const nowISO = new Date().toISOString();
      const { error } = await supabase.from('orders').update({ status, updated_at: nowISO }).eq('id', id);
      if (error) throw error;
      
      setOrders(prev => {
        const target = prev.find(o => o.id === id);
        if (target) {
          const updated = { ...target, status, updated_at: nowISO };
          if (status === 'Ready') {
            triggerBackgroundNotification(updated, 'READY');
          }
          return prev.map(o => o.id === id ? updated : o);
        }
        return prev;
      });
    } catch (e) { console.error(e); }
  };

  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);

  const deleteOrder = async (id: string, orderNumber: string) => {
    console.log("--- DELETE PROCESS STARTED ---");
    console.log("Order ID:", id);
    console.log("Order Number:", orderNumber);
    
    if (!id) {
      alert('خطأ: معرف الطلب مفقود');
      return;
    }
    
    setDeletingOrderId(id);
    try {
      console.log("Calling Supabase delete for ID:", id);
      
      const response = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
        
      console.log("Supabase Response:", response);

      if (response.error) {
        console.error("Supabase error details:", response.error);
        throw response.error;
      }
      
      console.log("Delete successful in database. Updating local state...");
      setOrders(prev => {
        const filtered = prev.filter(o => o.id !== id);
        console.log(`Local state updated. Remaining orders: ${filtered.length}`);
        return filtered;
      });
      
      alert('تم حذف الطلب بنجاح ✅');
      setOrderToDelete(null);
      
    } catch (e: any) {
      console.error("Delete failed with error:", e);
      alert(`فشل الحذف: ${e.message || 'خطأ غير معروف'}`);
    } finally {
      setDeletingOrderId(null);
      console.log("--- DELETE PROCESS FINISHED ---");
    }
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
    try {
      if (originalOrder) {
        const oldUsedSub = originalOrder.payment_method === 'Subscription';
        const newUsedSub = updatedOrder.payment_method === 'Subscription';

        const oldTotalItems = originalOrder.items.reduce((acc, i) => acc + i.quantity, 0);
        const newTotalItems = updatedOrder.items.reduce((acc, i) => acc + i.quantity, 0);

        if (oldUsedSub && newUsedSub) {
          if (originalOrder.customer_phone === updatedOrder.customer_phone) {
            const diff = oldTotalItems - newTotalItems;
            if (diff !== 0) {
              const sub = getCustomerSubscription(updatedOrder.customer_phone);
              if (sub) {
                await updateSubscriptionBalance(sub.id, sub.items_remaining + diff);
              }
            }
          } else {
            const oldSub = getCustomerSubscription(originalOrder.customer_phone);
            if (oldSub) {
              await updateSubscriptionBalance(oldSub.id, oldSub.items_remaining + oldTotalItems);
            }
            const newSub = getCustomerSubscription(updatedOrder.customer_phone);
            if (newSub) {
              await updateSubscriptionBalance(newSub.id, newSub.items_remaining - newTotalItems);
            }
          }
        } else if (oldUsedSub && !newUsedSub) {
          const oldSub = getCustomerSubscription(originalOrder.customer_phone);
          if (oldSub) {
            await updateSubscriptionBalance(oldSub.id, oldSub.items_remaining + oldTotalItems);
          }
        } else if (!oldUsedSub && newUsedSub) {
          const newSub = getCustomerSubscription(updatedOrder.customer_phone);
          if (newSub) {
            await updateSubscriptionBalance(newSub.id, newSub.items_remaining - newTotalItems);
          }
        }
      }

      if (editedSubscription) {
        const dbSubPayload: any = {
          package_id: editedSubscription.package_id,
          items_remaining: editedSubscription.items_remaining,
          total_items: editedSubscription.total_items,
          expiry_date: editedSubscription.expiry_date,
          is_active: editedSubscription.is_active,
          customer_name: isDbMultiTenant ? editedSubscription.customer_name : `${laundryId}|${editedSubscription.customer_name}`,
          customer_phone: isDbMultiTenant ? editedSubscription.customer_phone : `${laundryId}|${editedSubscription.customer_phone}`
        };
        if (isDbMultiTenant) {
          dbSubPayload.laundry_id = laundryId;
        }

        const { error: subErr } = await supabase.from('subscriptions').update(dbSubPayload).eq('id', editedSubscription.id);
        if (subErr) throw subErr;
        setSubscriptions(prev => prev.map(s => s.id === editedSubscription.id ? editedSubscription : s));
      }

      const dbOrderPayload: any = {
        ...updatedOrder,
        order_number: isDbMultiTenant ? updatedOrder.order_number : `${laundryId}-${updatedOrder.order_number}`,
        customer_name: isDbMultiTenant ? updatedOrder.customer_name : `${laundryId}|${updatedOrder.customer_name}`,
        customer_phone: isDbMultiTenant ? updatedOrder.customer_phone : `${laundryId}|${updatedOrder.customer_phone}`
      };
      if (isDbMultiTenant) {
        dbOrderPayload.laundry_id = laundryId;
      }

      const { error } = await supabase.from('orders').update(dbOrderPayload).eq('id', updatedOrder.id);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      setShowEditOrderModal(null);
      setOriginalOrder(null);
      alert('تم تحديث الطلب بنجاح');
    } catch (e: any) {
      alert(`فشل التحديث: ${e.message}`);
    }
  };

  const sendWhatsAppReminder = async (order: Order, context: MessageContext) => {
    if (sendingMessageIds.has(order.id)) return;
    setSendingMessageIds(prev => new Set(prev).add(order.id));
    
    const newWindow = window.open('about:blank', '_blank');
    if (!newWindow) {
      alert('الرجاء السماح بالنوافذ المنبثقة.');
      setSendingMessageIds(prev => { const n = new Set(prev); n.delete(order.id); return n; });
      return;
    }

    try {
      // تمرير السياق المطلوب (RECEIVED أو READY)
      const smartMsg = await generateSmartReminder(order, context);
      const fullMessage = `${smartMsg}\n\n📦 فاتورة: ${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ريال\n📍 الحالة: ${statusArabic[order.status]}\n\n${DISCLAIMER_TEXT}`;
      
      const cleanPhone = order.customer_phone.replace(/\D/g, '');
      const finalPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0/, '')}`;
      newWindow.location.href = `https://wa.me/${finalPhone}?text=${encodeURIComponent(fullMessage)}`;
    } catch (error) { 
      newWindow.close(); 
      alert("خطأ في معالجة الرسالة."); 
    }
    setSendingMessageIds(prev => { const n = new Set(prev); n.delete(order.id); return n; });
  };

  const handleDownloadPDF = (order: Order) => {
    const element = document.getElementById('print-area');
    if (!element) return;
    
    const opt = {
      margin: [10, 10],
      filename: `Laundry-Invoice-${order.order_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 800 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handleAddInventoryItem = async () => {
    if (!newInvItem.name) {
      alert('يرجى إدخال اسم المادة');
      return;
    }
    setLoading(true);
    const laundryId = ensureUUID(userProfile?.laundry_id || 'laund-unknown');
    try {
      const payload: any = {
        name: isDbMultiTenant ? newInvItem.name : `${laundryId}|${newInvItem.name}`,
        stock: newInvItem.stock,
        unit: newInvItem.unit,
        threshold: newInvItem.threshold
      };
      if (isDbMultiTenant) {
        payload.laundry_id = laundryId;
      }

      const { data, error } = await supabase
        .from('inventory')
        .insert([payload])
        .select();

      if (error) throw error;
      if (data && data.length > 0) {
        const cleanedRow = {
          ...data[0],
          name: cleanTenantString(data[0].name),
          consumption_per_use: newInvItem.defaultConsumption || 10
        };

        // Sync consumption mapping for categories
        const updatedCons = { ...inventoryConsumption };
        const categoryList = categories.length > 0 ? categories : INITIAL_ITEMS;

        categoryList.forEach(cat => {
          const catName = cat.name;
          const val = newInvConsumption[catName] !== undefined
            ? newInvConsumption[catName]
            : 0;
          
          if (val > 0) {
            if (!updatedCons[catName]) {
              updatedCons[catName] = {};
            }
            updatedCons[catName][cleanedRow.id] = val;
          }
        });

        setInventoryConsumption(updatedCons);
        localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updatedCons));
        await syncInventoryConsumptionToDb(updatedCons);

        setInventory([cleanedRow, ...inventory]);
        setIsInvModalOpen(false);
        setNewInvItem({ name: '', stock: 0, unit: 'قطعة', threshold: 5, defaultConsumption: 10 });
        setNewInvConsumption({});
        alert('تم إضافة المادة وربط استهلاكها بالأصناف بنجاح ✅');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintNewPage = (order: Order) => {
    const discountPercent = (order.items?.[0] as any)?.discount_percent || 0;
    const laundryName = userProfile?.laundry_name || 'مغسلة عود ونظافة';
    const logoLetter = laundryName[0]?.toUpperCase() || 'M';

    // Expose a function to generate the WhatsApp URL
    (window as any).getWhatsAppUrlForPrint = async () => {
      try {
        const smartMsg = await generateSmartReminder(order, 'RECEIVED');
        const fullMessage = `${smartMsg}\n\n📦 فاتورة: ${order.order_number}\n💰 الإجمالي: ${order.total.toFixed(2)} ريال\n📍 الحالة: ${statusArabic[order.status]}\n\n${DISCLAIMER_TEXT}`;
        const cleanPhone = order.customer_phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0/, '')}`;
        return `https://wa.me/${finalPhone}?text=${encodeURIComponent(fullMessage)}`;
      } catch (e) {
        console.error("Failed to generate WhatsApp URL:", e);
        throw e;
      }
    };

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHtml = getGroupedItems(order.items || []).map((group, idx) => {
      const opts: string[] = [];
      const item = group.item;
      if (item.service_type === 'مستعجل' || (item as any).is_urgent) opts.push('مستعجل 🔥');
      if (item.is_ironing_only) opts.push('كوي');
      if ((item as any).is_no_ironing || item.ironing_type === 'بدون كوي') opts.push('بدون كوي');
      if (opts.length === 0) opts.push('عادي');
      const optionsText = opts.join(' + ');
      
      return `
        <tr class="group-header-row" onclick="const detail = document.getElementById('print-detail-${idx}'); if(detail) { detail.style.display = detail.style.display === 'none' ? 'table-row-group' : 'none'; }" style="cursor: pointer; transition: all 0.15s;">
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
            <div style="font-weight: 800; color: #1e293b;">${item.name}</div>
            <div style="font-size: 11px; color: #64748b; font-weight: normal; margin-top: 2px;">(${optionsText})</div>
          </td>
          <td style="text-align: center; padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 900; color: #4f46e5;">
            <span style="background: #e0e7ff; padding: 4px 8px; border-radius: 8px;">${group.totalQty}</span>
            <div class="no-print" style="font-size: 8px; color: #94a3b8; font-weight: normal; margin-top: 2px;">(اضغط للتفاصيل)</div>
          </td>
          <td style="text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #1e293b;">${(group.totalPrice).toFixed(2)} ر.س</td>
        </tr>
        <tbody id="print-detail-${idx}" class="no-print" style="display: none; background: #f8fafc;">
          ${group.originalItems.map((orig, subIdx) => `
            <tr>
              <td style="padding: 8px 24px; font-size: 13px; color: #475569; font-weight: 600;">◀ قطعة ${subIdx + 1}: ${orig.name}</td>
              <td style="text-align: center; padding: 8px; font-size: 13px; color: #475569;">1</td>
              <td style="text-align: left; padding: 8px 12px; font-size: 13px; color: #475569; font-weight: 600;">${orig.price.toFixed(2)} ر.س</td>
            </tr>
          `).join('')}
        </tbody>
      `;
    }).join('');

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>فاتورة رقم ${order.order_number}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
            body { font-family: 'Cairo', sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 40px; }
            .logo { font-size: 40px; font-weight: 900; background: #1e1b4b; color: #fff; width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; border-radius: 24px; }
            .info { margin-bottom: 40px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 24px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .info-item { display: flex; flex-direction: column; gap: 4px; }
            .info-label { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; }
            .info-value { font-size: 16px; font-weight: 900; color: #1e293b; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
            .items-table th { text-align: right; padding: 12px; border-bottom: 2px solid #e2e8f0; color: #64748b; font-size: 14px; }
            .items-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 15px; font-weight: 700; }
            .summary { background: #f8fafc; padding: 32px; border-radius: 32px; margin-top: 40px; }
            .summary-item { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; font-weight: 700; color: #64748b; }
            .summary-total { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 20px; border-top: 2px dashed #e2e8f0; }
            .total-label { font-size: 20px; font-weight: 900; color: #1e293b; }
            .total-amount { font-size: 28px; font-weight: 900; color: #4f46e5; }
            .disclaimer { margin-top: 60px; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.8; padding: 0 40px; font-weight: 700; }
            .footer { margin-top: 60px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 40px; display: flex; flex-direction: column; align-items: center; gap: 15px; }
            .btn { padding: 18px 60px; border: none; border-radius: 20px; font-size: 18px; font-weight: 900; cursor: pointer; transition: all 0.2s; width: 100%; max-width: 300px; }
            .btn-print { background: #4f46e5; color: white; box-shadow: 0 10px 20px rgba(79, 70, 229, 0.2); }
            .btn-whatsapp { background: #10b981; color: white; box-shadow: 0 10px 20px rgba(16, 185, 129, 0.2); }
            @media print {
              .no-print { display: none; }
              body { padding: 20px; }
              .summary { background: #fff; border: 1px solid #f1f5f9; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">${logoLetter}</div>
            <h1 style="margin: 0; font-size: 28px; font-weight: 900;">${laundryName}</h1>
            <p style="color: #64748b; font-weight: 700; margin-top: 8px;">فاتورة ضريبية مبسطة</p>
          </div>
          
          <div class="info">
            <div class="info-item"><span class="info-label">العميل</span><span class="info-value">${order.customer_name}</span></div>
            <div class="info-item"><span class="info-label">رقم الهاتف</span><span class="info-value" dir="ltr">${order.customer_phone}</span></div>
            <div class="info-item"><span class="info-label">رقم الفاتورة</span><span class="info-value">#${order.order_number}</span></div>
            <div class="info-item"><span class="info-label">التاريخ</span><span class="info-value">${new Date(order.created_at).toLocaleString('ar-SA')}</span></div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>الصنف</th>
                <th style="text-align: center;">الكمية</th>
                <th style="text-align: left;">السعر</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="summary">
            ${discountPercent > 0 ? `
              <div class="summary-item"><span>المجموع المبدئي</span><span>${(order.subtotal / (1 - discountPercent/100)).toFixed(2)} ر.س</span></div>
              <div class="summary-item" style="color: #ef4444; font-weight: 950;"><span>خصم (${discountPercent}%)</span><span>-${((order.subtotal / (1 - discountPercent/100)) * (discountPercent/100)).toFixed(2)} ر.س</span></div>
              <div class="summary-item"><span>المجموع بعد الخصم</span><span>${order.subtotal.toFixed(2)} ر.س</span></div>
            ` : `
              <div class="summary-item"><span>المجموع الفرعي</span><span>${order.subtotal.toFixed(2)} ر.س</span></div>
            `}
            <div class="summary-item"><span>ضريبة القيمة المضافة (15%)</span><span>${order.tax.toFixed(2)} ر.س</span></div>
            ${order.custom_adjustment !== 0 ? `<div class="summary-item"><span>تعديل إضافي</span><span>${order.custom_adjustment.toFixed(2)} ر.س</span></div>` : ''}
            <div class="summary-total">
              <span class="total-label">الإجمالي النهائي</span>
              <span class="total-amount">${order.total.toFixed(2)} ر.س</span>
            </div>
          </div>

          <div class="disclaimer">
            تنويه هام: المغسلة غير مسؤولة عن فقدان أي أغراض شخصية تُترك داخل الملابس عند استلامها، كما لا تتحمل مسؤولية حفظ الملابس أو الأغراض بعد مضي (15) يومًا من تاريخ الاستلام.
          </div>

          <div class="footer no-print">
            <button class="btn btn-print" onclick="window.print()">طباعة الفاتورة</button>
            <button class="btn btn-whatsapp" onclick="handleWhatsApp()">إرسال واتساب يدوي</button>
            <p style="margin-top: 20px; font-size: 13px; color: #94a3b8; font-weight: 700;">شكراً لثقتكم بنا!</p>
          </div>

          <script>
            async function handleWhatsApp() {
              const btn = event.target;
              btn.disabled = true;
              const originalText = btn.innerText;
              btn.innerText = 'جاري التجهيز...';
              
              // Open window immediately to avoid popup blocker
              const waWindow = window.open('about:blank', '_blank');
              
              try {
                const url = await window.opener.getWhatsAppUrlForPrint();
                if (waWindow) {
                  waWindow.location.href = url;
                }
              } catch (e) {
                if (waWindow) waWindow.close();
                alert('حدث خطأ في تجهيز الرسالة');
              } finally {
                btn.disabled = false;
                btn.innerText = originalText;
              }
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleUpdateStock = async (id: string, delta: number) => {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newStock = Math.max(0, item.stock + delta);
    try {
      const { error } = await supabase.from('inventory').update({ stock: newStock }).eq('id', id);
      if (error) throw error;
      setInventory(inventory.map(i => i.id === id ? { ...i, stock: newStock } : i));
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteInventoryItem = async (id: string, name: string) => {
    console.log("Attempting to delete inventory item:", { id, name });
    try {
      console.log("Calling Supabase delete for inventory id:", id);
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) {
        console.error("Supabase delete error:", error);
        throw error;
      }
      console.log("Delete successful, updating state");
      setInventory(prev => prev.filter(i => i.id !== id));
      alert('تم حذف المادة بنجاح ✅');
    } catch (e: any) { 
      console.error("Delete inventory item failed:", e);
      alert(e.message); 
    }
  };

  const filteredOrders = useMemo(() => {
    // Prevent duplicate order records in list
    const uniqueMap = new Map<string, Order>();
    orders.forEach(o => {
      if (o && o.id) uniqueMap.set(o.id, o);
    });
    const uniqueOrders = Array.from(uniqueMap.values());

    return uniqueOrders.filter(o => {
      const matchesSearch = o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           o.customer_phone.includes(searchQuery);
      if (!matchesSearch) return false;
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (timeFilter !== 'all') {
        const hour = 3600000;
        const day = 86400000;
        const twoDays = 172800000;
        const orderTimestamp = new Date(o.created_at).getTime();
        const passedTimeMs = Date.now() - orderTimestamp;
        if (timeFilter === '1h') return passedTimeMs >= hour && passedTimeMs < day;
        if (timeFilter === '24h') return passedTimeMs >= day && passedTimeMs < twoDays;
        if (timeFilter === '48h') return passedTimeMs >= twoDays;
      }
      return true;
    });
  }, [orders, searchQuery, timeFilter, statusFilter]);

  if (!session) {
    return <Auth onAuthSuccess={() => {}} />;
  }

  if (dbError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border-t-4 border-red-500 text-center">
          <Database size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-black mb-4">خطأ في الاتصال</h2>
          <p className="text-slate-500 mb-8">{dbError}</p>
          <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold">تحديث الصفحة</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#F3F4F6]">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-24 xl:w-64 bg-white border-l p-4 py-6 sticky top-0 h-screen no-print transition-all shrink-0 overflow-hidden">
        <div className="flex items-center justify-center xl:justify-start gap-3 mb-8 px-2 shrink-0">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0"><ShoppingCart size={24} /></div>
          <div className="hidden xl:block"><h1 className="text-base font-black leading-tight text-slate-800">مغسلة نظافة وعود</h1><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Laundry Pro v5.8</p></div>
        </div>
        <nav className="space-y-1.5 overflow-y-auto flex-1 pr-1 pl-1 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {allowedNavItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id as any)} className={`w-full flex flex-col xl:flex-row items-center justify-center xl:justify-start gap-1.5 xl:gap-3.5 px-2 py-3 xl:px-4 xl:py-3.5 rounded-2xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-700'}`}>
              <item.icon size={20} className="shrink-0" /><span className="text-[10px] xl:text-xs font-black">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-100 bg-white shrink-0">
          <div className="hidden xl:block overflow-hidden w-full mb-3 px-1">
            <p className="text-xs font-black text-slate-800 truncate mb-1">{userProfile?.full_name || userProfile?.email}</p>
            <span className="inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5">
              {userProfile?.role === 'admin' ? 'مدير النظام (Admin)' : userProfile?.role === 'manager' ? 'مشرف (Manager)' : 'موظف (Staff)'}
            </span>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center xl:justify-start gap-3 px-3 xl:px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 transition-all font-black text-xs"
          >
            <X size={20} className="shrink-0" /><span className="hidden xl:block">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Mobile Navbar */}
      <nav className="md:hidden flex items-center justify-between px-6 py-4 bg-white border-b sticky top-0 z-[150] shadow-sm no-print">
        <div className="flex items-center gap-3"><ShoppingCart size={20} className="text-indigo-600" /><h1 className="text-lg font-black">مغلسة نظافة وعود</h1></div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-500"><Menu size={24} /></button>
      </nav>
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[140] no-print" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="absolute top-20 left-6 right-6 bg-white rounded-[2.5rem] p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
             <div className="space-y-3">
                {allowedNavItems.map(item => (
                  <button key={item.id} onClick={() => { setActiveTab(item.id as any); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><item.icon size={22} /><span className="text-sm font-black">{item.label}</span></button>
                ))}
                <div className="pt-4 mt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500"><User size={20} /></div>
                    <div>
                      <p className="text-sm font-black text-slate-800">{userProfile?.full_name || userProfile?.email}</p>
                      <span className="inline-block text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5 mt-1">
                        {userProfile?.role === 'admin' ? 'مدير النظام (Admin)' : userProfile?.role === 'manager' ? 'مشرف (Manager)' : 'موظف (Staff)'}
                      </span>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-red-500 hover:bg-red-50 transition-all"><X size={22} /><span className="text-sm font-black">تسجيل الخروج</span></button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto no-print">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
          <div><h2 className="text-2xl font-black text-slate-900">{navItems.find(n => n.id === activeTab)?.label}</h2><p className="text-slate-500 text-sm font-medium">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p></div>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 lg:flex-none">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="رقم الطلب أو العميل..." className="w-full lg:w-72 pr-12 pl-6 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button onClick={fetchData} className="p-3.5 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"><Repeat size={20} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </header>

        {activeTab === 'new-order' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500 max-w-[1600px] mx-auto">
            <div className="lg:col-span-8 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h3 className="text-xl font-black flex items-center gap-3"><PlusCircle className="text-indigo-600" /> اختر الملابس</h3>
                <button onClick={() => setIsEditingPrices(!isEditingPrices)} className={`px-5 py-2 rounded-lg text-xs font-black flex items-center gap-2 transition-all ${isEditingPrices ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-600 border'}`}><Settings2 size={14} /> {isEditingPrices ? 'حفظ الأسعار' : 'تعديل الأسعار'}</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
                {!isCategoriesLoaded && categories.length === 0 ? (
                  <div className="col-span-full flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                  </div>
                ) : (
                  <>
                    {categories.map((item, idx) => (
                      <div 
                        key={item.id || item.name || idx} 
                        className={`relative group transition-all duration-200 ${draggedIndex === idx ? 'opacity-40 scale-95 border-2 border-dashed border-indigo-400 rounded-3xl' : ''}`}
                        draggable={!isEditingPrices}
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnter={(e) => handleDragEnter(e, idx)}
                        onDragEnd={handleDragEnd}
                      >
                        <div 
                          onClick={() => {
                            if (isEditingPrices) {
                              openEditCategoryModal(idx);
                            } else {
                              togglePredefinedItem(item);
                            }
                          }} 
                          className={`w-full flex flex-col items-center justify-center p-5 bg-white border border-slate-100 rounded-3xl transition-all relative group cursor-pointer ${
                            isEditingPrices 
                              ? 'border-indigo-200 bg-indigo-50/10 hover:border-indigo-500 hover:shadow-md' 
                              : 'hover:bg-indigo-600 hover:text-white active:scale-95 cursor-grab active:cursor-grabbing'
                          }`}
                        >
                          {/* Edit Badge when in Edit Mode */}
                          {isEditingPrices && (
                            <div 
                              className="absolute top-3 left-3 bg-indigo-600 text-white p-1.5 rounded-full shadow-md group-hover:scale-110 transition-all flex items-center justify-center cursor-pointer"
                              title="تعديل الصنف"
                            >
                              <Edit2 size={12} />
                            </div>
                          )}

                          <div className="relative mb-2 flex items-center justify-center">
                            <div className="relative">
                              <span className="text-3xl block p-1.5 bg-slate-50 border border-slate-100 rounded-2xl">{item.icon || '✨'}</span>
                            </div>
                          </div>
                          <span className="text-sm font-black mb-2 text-center text-slate-900 group-hover:text-inherit">{item.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-200">
                            {getItemPrices(item).price_normal} ريال
                          </span>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setShowCustomItemModal(true)} className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl hover:bg-indigo-50 transition-all active:scale-95"><Plus size={24} className="mb-2"/><span className="text-sm font-black">صنف مخصص</span></button>
                  </>
                )}
              </div>
            </div>
            <div className="lg:col-span-4 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 flex flex-col h-full">
              <h3 className="text-xl font-black mb-6">تفاصيل العميل والطلب</h3>
              {newOrder.customer_phone && (
                <div className="mb-6 space-y-3">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                          <Layers size={20} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">إحصائيات العميل</p>
                          <p className="text-lg font-black text-indigo-700">{getCustomerStats(newOrder.customer_phone).totalItems} قطعة</p>
                        </div>
                      </div>
                      {getCustomerStats(newOrder.customer_phone).totalItems >= 100 && (
                        <div className="bg-emerald-500 text-white px-3 py-1 rounded-lg text-[10px] font-black animate-bounce">
                          مؤهل للمكافأة! 🎁
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-indigo-100/50">
                      <div className="text-center">
                        <p className="text-[9px] font-black text-slate-400 uppercase">مدفوع</p>
                        <p className="text-sm font-black text-indigo-600">{getCustomerStats(newOrder.customer_phone).paidItems}</p>
                      </div>
                      <div className="text-center border-r border-indigo-100/50">
                        <p className="text-[9px] font-black text-slate-400 uppercase">مجاني</p>
                        <p className="text-sm font-black text-emerald-600">{getCustomerStats(newOrder.customer_phone).freeItems}</p>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const sub = getCustomerSubscription(newOrder.customer_phone);
                    const selectedPkg = selectedOrderPackageId ? subscriptionPackages.find(p => p.id === selectedOrderPackageId) : null;
                    
                    if (sub) {
                      return (
                        <>
                          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm">
                                <CreditCard size={20} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">الرصيد المتبقي</p>
                                  <div className="flex items-center gap-1">
                                    <span className="text-sm font-black text-emerald-700">{sub.items_remaining}</span>
                                    <span className="text-xs font-bold text-emerald-600">/ {sub.total_items}</span>
                                  </div>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className="text-[9px] font-black text-slate-400 uppercase">ينتهي في</p>
                              <p className="text-[10px] font-bold text-emerald-600">{safeFormatDate(sub.expiry_date)}</p>
                            </div>
                          </div>
                          
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                            <label className="text-xs font-black text-slate-500 block">طريقة محاسبة الطلب للعميل المشترك:</label>
                            <select 
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20 text-right text-slate-700"
                              value={useSubscription ? "yes" : "no"}
                              onChange={e => setUseSubscription(e.target.value === "yes")}
                            >
                              <option value="yes">خصم من رصيد باقة الاشتراك 🟢</option>
                              <option value="no">دفع خارجي (نقدي / شبكة / تحويل) 💵</option>
                            </select>
                          </div>
                        </>
                      );
                    } else if (selectedPkg) {
                      return (
                        <>
                          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                                <CreditCard size={20} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase">باقة جديدة سيتم تفعيلها</p>
                                <p className="text-sm font-black text-amber-800">{selectedPkg.name}</p>
                              </div>
                            </div>
                            <div className="text-left">
                              <p className="text-[9px] font-black text-slate-400 uppercase">سعر الباقة</p>
                              <p className="text-xs font-black text-amber-700">{selectedPkg.price} ر.س</p>
                            </div>
                          </div>
                          
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                            <label className="text-xs font-black text-slate-500 block">طريقة محاسبة الطلب للعميل المشترك الجديد:</label>
                            <select 
                              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none focus:ring-2 focus:ring-indigo-500/20 text-right text-slate-700"
                              value={useSubscription ? "yes" : "no"}
                              onChange={e => setUseSubscription(e.target.value === "yes")}
                            >
                              <option value="yes">خصم من رصيد الباقة الجديدة 🟢</option>
                              <option value="no">دفع خارجي (نقدي / شبكة / تحويل) 💵</option>
                            </select>
                          </div>
                        </>
                      );
                    } else {
                      return (
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-600 shadow-sm">
                              <CreditCard size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase">باقة الاشتراك</p>
                              <p className="text-sm font-black text-amber-800">لا يوجد اشتراك نشط للعميل</p>
                            </div>
                          </div>
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setShowAssignSubModal({ name: newOrder.customer_name || 'عميل جديد', phone: newOrder.customer_phone });
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                          >
                            <PlusCircle size={14} /> تفعيل باقة اشتراك للعميل
                          </button>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
              <div className="space-y-4 mb-6">
                <div className="relative"><User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="اسم العميل" className="w-full pr-12 pl-4 py-4 bg-slate-50 border rounded-2xl outline-none font-bold" value={newOrder.customer_name} onChange={e => setNewOrder({...newOrder, customer_name: e.target.value})} /></div>
                <div className="relative text-left"><Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="tel" placeholder="رقم الواتساب" className="w-full pr-12 pl-4 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-left" dir="ltr" value={newOrder.customer_phone} onChange={e => setNewOrder({...newOrder, customer_phone: e.target.value})} /></div>
                
                {/* Always-visible Subscription Package Selector */}
                <div className="space-y-1 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-black text-indigo-600 uppercase flex items-center gap-1">
                    <CreditCard size={12} /> باقة الاشتراك للعميل (اختياري)
                  </label>
                  {(() => {
                    const sub = getCustomerSubscription(newOrder.customer_phone);
                    if (sub) {
                      const pkg = subscriptionPackages.find(p => p.id === sub.package_id);
                      return (
                        <div className="text-xs font-black text-emerald-600 pt-1 flex items-center gap-1.5">
                          <span>🟢 العميل مسجل في باقة: <strong>{pkg?.name || 'باقة نشطة'}</strong> (رصيد: {sub.items_remaining} قطعة)</span>
                        </div>
                      );
                    }
                    return (
                      <select 
                        className="w-full px-3 py-3 bg-white border rounded-xl outline-none font-black text-xs text-right text-slate-700 focus:ring-2 focus:ring-indigo-500/20"
                        value={selectedOrderPackageId}
                        onChange={e => {
                          const pkgId = e.target.value;
                          setSelectedOrderPackageId(pkgId);
                          if (pkgId) {
                            setUseSubscription(true);
                          }
                        }}
                      >
                        <option value="">-- بدون باقة (حساب فردي) --</option>
                        {subscriptionPackages.map(pkg => (
                          <option key={pkg.id} value={pkg.id}>
                            {pkg.name} ({pkg.total_items} قطعة - {pkg.price} ر.س)
                          </option>
                        ))}
                      </select>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="relative"><Banknote className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="number" placeholder="تعديل مالي" className="w-full pr-12 pl-4 py-4 bg-indigo-50/50 border rounded-2xl outline-none font-bold text-xs" value={newOrder.custom_adjustment || ''} onChange={e => setNewOrder({...newOrder, custom_adjustment: parseFloat(e.target.value) || 0})} /></div>
                  <div className="relative"><div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">%</div><input type="number" min="0" max="100" placeholder="خصم %" className="w-full pr-10 pl-4 py-4 bg-red-50/30 border border-red-100 rounded-2xl outline-none font-bold text-xs" value={newOrder.discount_percent || ''} onChange={e => setNewOrder({...newOrder, discount_percent: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))})} /></div>
                </div>
              </div>
              <div className="flex gap-3 mb-6">
                 <button onClick={() => setNewOrder({...newOrder, order_type: 'Normal'})} className={`flex-1 py-3 rounded-xl border font-black ${newOrder.order_type === 'Normal' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white text-slate-400'}`}>عادي</button>
                 <button onClick={() => setNewOrder({...newOrder, order_type: 'Urgent'})} className={`flex-1 py-3 rounded-xl border font-black ${newOrder.order_type === 'Urgent' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white text-slate-400'}`}>مستعجل 🔥</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button 
                  onClick={() => setNewOrder({...newOrder, is_free: !newOrder.is_free})} 
                  className={`py-3 rounded-xl border font-black transition-all flex items-center justify-center gap-2 ${newOrder.is_free ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-200'}`}
                >
                  {newOrder.is_free ? <Check size={18} /> : <Gift size={18} />}
                  {newOrder.is_free ? 'طلب مجاني ✅' : 'طلب مجاني؟'}
                </button>
                <button 
                  onClick={() => setNewOrder({...newOrder, is_tax_enabled: !newOrder.is_tax_enabled})} 
                  className={`py-3 rounded-xl border font-black transition-all flex items-center justify-center gap-2 ${newOrder.is_tax_enabled ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-200'}`}
                >
                  {newOrder.is_tax_enabled ? <Check size={18} /> : <AlertTriangle size={18} />}
                  {newOrder.is_tax_enabled ? 'الضريبة مفعلة' : 'بدون ضريبة'}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[30vh] space-y-3 mb-6 pr-1 custom-scrollbar">
                {newOrder.items.map(item => (
                  <div key={item.id} className="flex flex-col gap-2 p-4 bg-slate-50 rounded-2xl border">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-sm font-black">{item.name}</span>
                        <span className="text-[10px] font-bold text-indigo-600">{(item.quantity * item.price).toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateItemQuantity(item.id, -1)} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center text-red-500"><Trash2 size={14} /></button>
                        <span className="text-sm font-black">{item.quantity}</span>
                        <button onClick={() => updateItemQuantity(item.id, 1)} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center text-emerald-500"><Plus size={14} /></button>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                      {/* Independent Option Selectors */}
                      <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100/80 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            updateItemMode(item.id, 'عادي');
                          }}
                          className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                            item.is_normal
                              ? 'bg-slate-500 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-white/50 bg-transparent'
                          }`}
                        >
                          عادي
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateItemMode(item.id, 'مستعجل');
                          }}
                          className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                            (item.is_urgent || item.service_type === 'مستعجل')
                              ? 'bg-red-500 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-white/50 bg-transparent'
                          }`}
                        >
                          مستعجل 🔥
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateItemMode(item.id, 'كوي');
                          }}
                          className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                            item.is_ironing_only
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-500 hover:bg-white/50 bg-transparent'
                          }`}
                        >
                          كوي
                        </button>
                      </div>

                      {/* Custom Price Inputs for عادي / مستعجل / كوي */}
                      <div className="grid grid-cols-3 gap-1.5 text-[8.5px] font-bold text-slate-400 mt-1">
                        <div className="flex flex-col gap-1 text-center">
                          <span className="text-slate-500 font-black">عادي</span>
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                            <input 
                              type="number" 
                              step="0.5"
                              className="w-full text-center font-black text-[9px] outline-none text-slate-700 bg-transparent"
                              value={getItemPrices(item).price_normal}
                              onChange={e => updateItemCustomPrice(item.id, 'normal', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 text-center">
                          <span className="text-red-500 font-black">مستعجل</span>
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                            <input 
                              type="number" 
                              step="0.5"
                              className="w-full text-center font-black text-[9px] outline-none text-slate-700 bg-transparent"
                              value={getItemPrices(item).price_urgent}
                              onChange={e => updateItemCustomPrice(item.id, 'urgent', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 text-center">
                          <span className="text-indigo-600 font-black">كوي</span>
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                            <input 
                              type="number" 
                              step="0.5"
                              className="w-full text-center font-black text-[9px] outline-none text-slate-700 bg-transparent"
                              value={getItemPrices(item).price_ironing}
                              onChange={e => updateItemCustomPrice(item.id, 'ironing', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-[#1E1B4B] text-white p-8 rounded-[2.5rem] shadow-2xl mt-auto">
                  <div className="space-y-3 mb-6">
                    {newOrder.discount_percent > 0 && (
                      <div className="flex justify-between items-center text-slate-400 text-xs font-bold">
                        <span>المجموع المبدئي:</span>
                        <span>{(newOrder.items.reduce((acc, i) => acc + (i.price * i.quantity), 0) + newOrder.custom_adjustment).toFixed(2)} ر.س</span>
                      </div>
                    )}
                    {newOrder.discount_percent > 0 && (
                      <div className="flex justify-between items-center text-red-400 text-xs font-black">
                        <span>خصم ({newOrder.discount_percent}%):</span>
                        <span>-{((newOrder.items.reduce((acc, i) => acc + (i.price * i.quantity), 0) + newOrder.custom_adjustment) * (newOrder.discount_percent / 100)).toFixed(2)} ر.س</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-slate-400 text-sm font-bold"><span>المجموع:</span><span>{currentSubtotal.toFixed(2)} ر.س</span></div>
                    <div className="flex justify-between items-center text-slate-400 text-sm font-bold"><span>الضريبة ({newOrder.is_tax_enabled ? '15%' : '0%'}):</span><span>{currentTax.toFixed(2)} ر.س</span></div>
                    <div className="flex justify-between items-end border-t border-white/10 pt-4"><span className="font-black text-xl">الإجمالي</span><span className="font-black text-3xl text-indigo-400">{currentTotal.toFixed(2)} ر.س</span></div>
                  </div>
                 <div className="grid grid-cols-2 gap-3 mb-4">
                    <button onClick={() => setNewOrder({...newOrder, is_paid: !newOrder.is_paid})} className={`py-3 rounded-xl border font-black text-xs ${newOrder.is_paid ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-white'}`}>{newOrder.is_paid ? 'تم السداد ✅' : 'لم يسدد'}</button>
                    {newOrder.is_paid && (
                      <select className="bg-white/10 border border-white/10 rounded-xl py-3 px-3 text-xs font-black text-white" value={newOrder.payment_method} onChange={e => setNewOrder({...newOrder, payment_method: e.target.value as any})}>
                        <option value="Cash" className="text-black">نقدي</option>
                        <option value="Card" className="text-black">شبكة</option>
                        {getCustomerSubscription(newOrder.customer_phone) && useSubscription && (
                          <option value="Subscription" className="text-black">من الاشتراك</option>
                        )}
                      </select>
                    )}
                 </div>
                 <button disabled={loading || (newOrder.items.length === 0 && newOrder.custom_adjustment === 0)} onClick={handleCreateOrder} className="w-full bg-white text-indigo-900 py-5 rounded-2xl font-black text-xl hover:bg-indigo-50 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30">
                   {loading ? <Loader2 className="animate-spin" /> : <><Printer size={22} /> حفظ وطباعة</>}
                 </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 bg-white border p-2 rounded-2xl">
                 <Filter size={16} className="text-slate-400 mr-2" />
                 <select className="bg-transparent text-sm font-black text-slate-700 outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
                    <option value="all">كل الحالات</option>{Object.entries(statusArabic).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                 </select>
              </div>
              <div className="flex gap-2 p-1.5 bg-white rounded-2xl border overflow-x-auto">
                {['all', '1h', '24h', '48h'].map(f => (
                  <button key={f} onClick={() => setTimeFilter(f as any)} className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all ${timeFilter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>{f === 'all' ? 'الكل' : `+${f}`}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredOrders.map(order => (
                <div key={order.id} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-7 hover:border-indigo-100 transition-all group">
                   <div className="flex justify-between mb-4"><span className="text-[10px] font-mono bg-slate-50 px-2 py-1 rounded">#{order.order_number}</span><span className={`px-3 py-1 rounded-full text-[10px] font-black ${order.order_type === 'Urgent' ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>{order.order_type === 'Urgent' ? 'مستعجل 🔥' : 'عادي'}</span></div>
                   <h4 className="font-black text-xl mb-1">{order.customer_name}</h4>
                   <p className="text-sm font-bold text-indigo-500 mb-6">{order.customer_phone}</p>
                   {/* Items treatment options details block */}
                   <div className="space-y-1.5 mb-6 text-xs font-bold text-slate-600 bg-slate-50 p-4 rounded-3xl border border-slate-100/50">
                     {(() => {
                       const groups = getGroupedItems(order.items || []);
                       return groups.map((group) => {
                         const isExpanded = expandedGroups[`${order.id}_${group.key}`];
                         const optText = (() => {
                           const opts: string[] = [];
                           if (group.item.service_type === 'مستعجل' || (group.item as any).is_urgent) opts.push('مستعجل 🔥');
                           if (group.item.is_ironing_only) opts.push('كوي');
                           if ((group.item as any).is_no_ironing || group.item.ironing_type === 'بدون كوي') opts.push('بدون كوي');
                           if (opts.length === 0) opts.push('عادي');
                           return opts.join(' + ');
                         })();

                         return (
                           <div key={group.key} className="border-b border-dashed border-slate-100 last:border-0 pb-1.5 last:pb-0 first:pt-0 pt-1.5 text-right">
                             {/* Group Header Row */}
                             <div 
                               onClick={() => toggleExpandGroup(order.id, group.key)}
                               className="flex justify-between items-center cursor-pointer hover:bg-slate-100/60 p-1 rounded-xl transition-all select-none"
                             >
                               <span className="flex items-center gap-1.5 text-[11px] font-black">
                                 <span>{group.item.name}</span>
                                 <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-black font-mono">x{group.totalQty}</span>
                                 <span className="text-[10px] text-slate-400 font-normal font-sans">({optText})</span>
                                </span>
                                <div className="flex items-center gap-1.5 font-sans">
                                  <span className="font-mono text-slate-500 text-[11.5px] font-bold">{group.totalPrice.toFixed(2)} ر.س</span>
                                  <span className="text-[10px] text-indigo-400 font-bold transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                                    ▼
                                  </span>
                                </div>
                             </div>
                             
                             {/* Expanded Individual Items List */}
                             {isExpanded && (
                               <div className="mt-1.5 mr-3 pr-3 border-r-2 border-indigo-100 space-y-1 text-right">
                                 {group.originalItems.map((orig, subIdx) => (
                                   <div key={subIdx} className="flex justify-between items-center text-[10px] text-slate-500 font-bold bg-white/40 p-1 px-2 rounded-lg">
                                     <span>قطعة {subIdx + 1} - {orig.name}</span>
                                     <span>{orig.price.toFixed(2)} ر.س</span>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         );
                       });
                     })()}
                     {order.items && order.items[0] && (order.items[0] as any).discount_percent > 0 && (
                       <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between text-red-500 text-[10px] font-black">
                         <span>خصم ({(order.items[0] as any).discount_percent}%)</span>
                         <span>-{( (order.subtotal / (1 - (order.items[0] as any).discount_percent/100)) * ((order.items[0] as any).discount_percent/100) ).toFixed(2)} ر.س</span>
                       </div>
                     )}
                   </div>
                   <div className="grid grid-cols-2 gap-3 mb-6 p-4 bg-slate-50 rounded-3xl border">
                      <div><p className="text-[9px] font-black text-slate-400 uppercase mb-1">الحالة</p><select className="w-full bg-transparent font-black text-indigo-700 text-xs outline-none" value={order.status} onChange={e => updateOrderStatus(order.id, e.target.value as any)}>{Object.entries(statusArabic).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                      <div className="text-left border-r pr-3 border-slate-200"><p className="text-[9px] font-black text-slate-400 uppercase mb-1">الإجمالي</p><p className={`text-sm font-black ${order.is_paid ? 'text-emerald-600' : 'text-red-500'}`}>{order.total.toFixed(2)} ر.س</p></div>
                   </div>
                    {getCustomerSubscription(order.customer_phone) && (
                      <div className="mb-6 p-4 bg-emerald-50 rounded-3xl border border-emerald-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CreditCard size={16} className="text-emerald-600" />
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase">الرصيد المتبقي</p>
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-black text-emerald-700">{getCustomerSubscription(order.customer_phone)?.items_remaining}</span>
                              <span className="text-[10px] font-bold text-emerald-600">قطعة</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="text-[9px] font-black text-slate-400 uppercase">المنتهي في</p>
                          <p className="text-[10px] font-bold text-emerald-600">{safeFormatDate(getCustomerSubscription(order.customer_phone)?.expiry_date)}</p>
                        </div>
                      </div>
                    )}
                    {order.payment_method === 'Free' && (
                      <div className="mb-4 px-4 py-2 bg-emerald-500 text-white rounded-xl text-center text-xs font-black shadow-sm">
                        هذا الطلب مجاني 🎁
                      </div>
                    )}
                    <div className="grid grid-cols-4 gap-2">
                       <button onClick={(e) => { e.stopPropagation(); handlePrintNewPage(order); }} className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all" title="طباعة"><Printer size={18} className="pointer-events-none" /></button>
                       <button onClick={(e) => { e.stopPropagation(); sendWhatsAppReminder(order, 'READY'); }} className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-emerald-600 transition-all" title="واتساب"><Send size={18} className="pointer-events-none" /></button>
                       <button onClick={(e) => { e.stopPropagation(); setShowEditOrderModal(order); setOriginalOrder(JSON.parse(JSON.stringify(order))); }} className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-blue-600 transition-all" title="تعديل"><Edit3 size={18} className="pointer-events-none" /></button>
                       {userProfile && (
                        <button 
                          disabled={deletingOrderId === order.id}
                          onClick={(e) => { 
                            e.stopPropagation();
                            console.log("Setting order to delete:", order.order_number);
                            setOrderToDelete(order);
                          }} 
                          className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-red-600 transition-all disabled:opacity-50" 
                          title="حذف"
                        >
                          {deletingOrderId === order.id ? <Loader2 size={18} className="animate-spin pointer-events-none" /> : <Trash2 size={18} className="pointer-events-none" />}
                        </button>
                       )}
                       <button onClick={(e) => {
                         e.stopPropagation();
                         setNewOrder({
                           customer_name: order.customer_name,
                           customer_phone: order.customer_phone,
                           order_type: 'Normal',
                           items: [],
                           is_paid: false,
                           payment_method: 'Cash',
                           custom_adjustment: 0,
                           is_free: false,
                           is_tax_enabled: true,
                           discount_percent: 0
                         });
                         setActiveTab('new-order');
                       }} className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-orange-600 transition-all" title="طلب جديد"><PlusCircle size={18} className="pointer-events-none" /></button>
                       <button onClick={(e) => { e.stopPropagation(); setShowAssignSubModal({ name: order.customer_name, phone: order.customer_phone }); }} className="p-3 bg-white border rounded-xl flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all" title="تفعيل اشتراك"><CreditCard size={18} className="pointer-events-none" /></button>
                       <button onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'Delivered'); }} className="col-span-2 p-3 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all gap-2 text-xs font-black"><CheckCircle size={18} className="pointer-events-none" /> تسليم</button>
                    </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'subscriptions' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl">
                    <CreditCard size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">الاشتراكات الشهرية المقدمة</h3>
                    <p className="text-slate-400 font-bold text-sm">إدارة باقات العملاء المسبقة الدفع</p>
                  </div>
                </div>
                <button onClick={() => { setEditingPackageId(null); setPackageForm({ name: '', total_items: '', price: '', duration_days: 30, discount_percent: '', isUnlimitedDays: false }); setShowPackageModal(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-lg shadow-indigo-100">
                  <PlusCircle size={20} /> إنشاء باقة جديدة
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {subscriptionPackages.map(pkg => (
                  <div key={pkg.id} className="bg-indigo-900 text-white rounded-[2rem] p-8 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-bl-full -mr-12 -mt-12 group-hover:scale-150 transition-all"></div>
                    <h4 className="text-lg font-black mb-1">{pkg.name}</h4>
                    <p className="text-indigo-300 text-xs mb-6">
                      {pkg.total_items} قطعة / {pkg.duration_days === 0 || pkg.duration_days >= 36500 ? 'لا محدود' : `${pkg.duration_days} يوم`}
                    </p>
                    <div className="flex items-end gap-1.5 mb-8">
                      <span className="text-4xl font-black">{pkg.price === 0 ? '0' : pkg.price}</span>
                      <span className="text-sm font-bold opacity-60 mb-1">{pkg.price === 0 ? 'ريال (مجاني)' : 'ريال'}</span>
                    </div>
                    <ul className="space-y-3 mb-8 text-sm font-medium">
                      <li className="flex items-center gap-2"><Check size={16} className="text-indigo-400" /> غسيل وكي</li>
                      <li className="flex items-center gap-2">
                        <Check size={16} className="text-indigo-400" /> 
                        صالحة لمدة: <strong>{pkg.duration_days === 0 || pkg.duration_days >= 36500 ? 'غير محدودة (لا تنتهي)' : `${pkg.duration_days} يوم`}</strong>
                      </li>
                      {pkg.discount_percent !== undefined && pkg.discount_percent > 0 && (
                        <li className="flex items-center gap-2 text-emerald-300 font-bold"><Check size={16} className="text-emerald-300" /> خصم إضافي {pkg.discount_percent}% للطلبات</li>
                      )}
                    </ul>
                    <div className="flex justify-between items-center gap-3 mt-6 pt-4 border-t border-white/10 relative z-10">
                      <button 
                        onClick={() => handleStartEditPackage(pkg)} 
                        className="flex-1 py-2 px-3 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                      >
                        <Edit2 size={12} /> تعديل
                      </button>
                      <button 
                        onClick={() => handleDeletePackage(pkg.id)} 
                        className="flex-1 py-2 px-3 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                      >
                        <Trash2 size={12} /> حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {subscriptions.length > 0 && (
              <div className="bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-100">
                <h3 className="text-xl font-black mb-8">العملاء المشتركين حالياً</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-black text-slate-400 text-sm">العميل</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الباقة</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الرصيد المتبقي</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">تاريخ الانتهاء</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {subscriptions.map(sub => {
                        const pkg = subscriptionPackages.find(p => p.id === sub.package_id);
                        const isExpired = sub.expiry_date && !isNaN(new Date(sub.expiry_date).getTime()) ? new Date(sub.expiry_date) < new Date() : true;
                        return (
                          <tr key={sub.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="py-6">
                              <p className="font-black text-slate-800">{sub.customer_name}</p>
                              <p className="text-xs text-slate-400">{sub.customer_phone}</p>
                            </td>
                            <td className="py-6 font-bold text-indigo-600">{pkg?.name || 'باقة محذوفة'}</td>
                            <td className="py-6">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden max-w-[100px]">
                                  <div 
                                    className="bg-emerald-500 h-full" 
                                    style={{ width: `${(sub.items_remaining / sub.total_items) * 100}%` }}
                                  ></div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    className="w-12 bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-xs font-black text-center"
                                    value={sub.items_remaining}
                                    onChange={(e) => updateSubscriptionBalance(sub.id, parseInt(e.target.value) || 0)}
                                  />
                                  <span className="text-xs font-bold text-slate-400">/ {sub.total_items}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-6 text-sm font-bold text-slate-500">
                              {safeFormatDate(sub.expiry_date)}
                            </td>
                            <td className="py-6">
                              <span className={`px-3 py-1 rounded-full text-[10px] font-black ${
                                !isExpired && sub.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                              }`}>
                                {!isExpired && sub.is_active ? 'نشط' : 'منتهي'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
               <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-10">
                 <div>
                   <h3 className="text-xl font-black">المواد الاستهلاكية</h3>
                   <p className="text-slate-400 text-sm font-bold">إدارة المخزون والمواد المستخدمة</p>
                 </div>
                 <div className="flex items-center gap-3 w-full md:w-auto">
                   <div className="relative flex-1 md:w-64">
                     <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                     <input 
                       type="text" 
                       placeholder="بحث في المخزون..." 
                       className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"
                       value={searchQuery}
                       onChange={(e) => setSearchQuery(e.target.value)}
                     />
                   </div>
                   <button onClick={fetchData} className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:text-indigo-600 transition-all">
                     <Repeat size={20} />
                   </button>
                   <button onClick={() => setIsInvModalOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
                     <Plus size={18} /> إضافة مادة
                   </button>
                 </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {inventory
                   .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
                   .map(item => (
                    <div key={item.id} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 hover:border-indigo-100 transition-all group">
                       <div className="flex justify-between items-center mb-6">
                         <div className={`p-4 rounded-2xl transition-all ${item.stock <= item.threshold ? 'bg-red-50 text-red-500' : 'bg-indigo-50 text-indigo-600'}`}>
                           <Layers size={24} />
                         </div>
                         <div className="flex gap-2">
                           <button onClick={(e) => { e.stopPropagation(); handleDeleteInventoryItem(item.id, item.name); }} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                             <Trash2 size={18} />
                           </button>
                         </div>
                       </div>
                       <h4 className="text-lg font-black text-slate-800 mb-1">{item.name}</h4>
                       <div className="flex items-baseline gap-2 mb-8">
                         <p className={`text-4xl font-black ${item.stock <= item.threshold ? 'text-red-500' : 'text-indigo-600'}`}>{item.stock}</p>
                         <span className="text-sm font-bold text-slate-400">{item.unit}</span>
                       </div>
                       
                       {item.stock <= item.threshold && (
                         <div className="flex items-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-wider mb-6 bg-red-50 w-fit px-3 py-1 rounded-full">
                           <AlertTriangle size={12} /> مخزون منخفض
                         </div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => handleUpdateStock(item.id, 1)} className="flex-1 bg-slate-100 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition-all">
                          <Plus size={16} /> زيادة
                        </button>
                        <button onClick={() => handleUpdateStock(item.id, -1)} className="flex-1 bg-white border border-slate-100 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
                          <Minus size={16} /> نقص
                        </button>
                      </div>
                      <button 
                        onClick={() => setEditingInvConsumptionItem(item)} 
                        className="w-full mt-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Settings2 size={14} /> ربط المادة بالأصناف الاستهلاكية
                      </button>
                    </div>
                  ))}
               </div>
               
               {inventory.length === 0 && !loading && (
                 <div className="text-center py-20">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                     <Package size={40} />
                   </div>
                   <h3 className="text-xl font-black text-slate-800 mb-2">لا يوجد مواد في المخزون</h3>
                   <p className="text-slate-400 font-bold">ابدأ بإضافة المواد الاستهلاكية التي تستخدمها في المغسلة</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500 text-right">
            
            {/* Filters Bar Card */}
            <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-sm border border-slate-100">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
                    <Filter className="text-indigo-600" size={24} />
                    تصفية الحسابات وإحصائيات مبيعات العملاء
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">تتبع مبيعات واشتراكات عميل معين لفترة زمنية محددة</p>
                </div>
                
                {/* Reset button if filter is active */}
                {(financeFromDate || financeToDate || financeSelectedClientPhone !== 'all' || financePendingFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setFinanceFromDate('');
                      setFinanceToDate('');
                      setFinanceSelectedClientPhone('all');
                      setFinancePendingFilter('all');
                    }}
                    className="self-end md:self-auto py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
                  >
                    إعادة تعيين الفلاتر
                  </button>
                )}
              </div>

              {/* Filter inputs grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
                
                {/* From Date */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 block">من تاريخ 📆</label>
                  <input
                    type="date"
                    value={financeFromDate}
                    onChange={(e) => setFinanceFromDate(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm text-right focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                  />
                </div>

                {/* To Date */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 block">إلى تاريخ 📆</label>
                  <input
                    type="date"
                    value={financeToDate}
                    onChange={(e) => setFinanceToDate(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm text-right focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                  />
                </div>

                {/* Target Client Dropdown */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 block">اختر العميل المستهدف 👥</label>
                  <select
                    value={financeSelectedClientPhone}
                    onChange={(e) => setFinanceSelectedClientPhone(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm text-right focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-700 font-bold"
                  >
                    <option value="all">جميع العملاء (الكل)</option>
                    {uniqueClients.map(c => (
                      <option key={c.phone} value={c.phone}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pending Amount Status Filter */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 block">تصفية حسب مبالغ معلقة 💰</label>
                  <select
                    value={financePendingFilter}
                    onChange={(e) => setFinancePendingFilter(e.target.value as any)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm text-right focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 transition-all text-slate-700 font-bold"
                  >
                    <option value="all">جميع الحالات (الكل)</option>
                    <option value="has_pending">عملاء لديهم مبالغ معلقة 🔴</option>
                    <option value="no_pending">عملاء بدون مبالغ معلقة 🟢</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Financial metrics & Payment Methods Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Primary Financial Performance Cards */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Grid of Main Amounts */}
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="bg-white p-7 rounded-[2rem] border shadow-sm flex flex-col justify-between">
                       <div>
                          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl w-fit mb-4">
                             <Banknote size={24} />
                          </div>
                          <p className="text-slate-400 text-[10px] font-black uppercase mb-1">المبيعات المحصلة</p>
                       </div>
                       <p className="text-3xl font-black text-emerald-600">
                          {financeStats.totalRevenue.toFixed(2)} <span className="text-xs">ر.س</span>
                       </p>
                    </div>

                    <div className="bg-white p-7 rounded-[2rem] border shadow-sm flex flex-col justify-between">
                       <div>
                          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl w-fit mb-4">
                             <Layers size={24} />
                          </div>
                          <p className="text-slate-400 text-[10px] font-black uppercase mb-1">الضريبة المحصلة (15%)</p>
                       </div>
                       <p className="text-3xl font-black text-indigo-600">
                          {financeStats.taxTotal.toFixed(2)} <span className="text-xs">ر.س</span>
                       </p>
                    </div>

                    <div className="bg-white p-7 rounded-[2rem] border shadow-sm flex flex-col justify-between">
                       <div>
                          <div className="p-3.5 bg-red-50 text-red-600 rounded-2xl w-fit mb-4">
                             <Wallet size={24} />
                          </div>
                          <p className="text-slate-400 text-[10px] font-black uppercase mb-1">المبالغ المعلقة غير المحصلة</p>
                       </div>
                       <p className="text-3xl font-black text-red-600">
                          {financeStats.pendingAmount.toFixed(2)} <span className="text-xs">ر.س</span>
                       </p>
                    </div>
                 </div>

                 {/* Detailed Payment Breakdowns */}
                 <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
                    <h3 className="text-lg font-black mb-6 text-slate-800 flex items-center gap-2">
                       <TrendingUp size={20} className="text-indigo-600" />
                       تفصيل مبيعات طرق الدفع (المحصلة للفترة)
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                       
                       <div className="p-5 bg-slate-50/70 border border-slate-100 rounded-2xl text-center">
                          <p className="text-[10px] font-black text-slate-400 mb-1">نقدي 💵</p>
                          <p className="text-xl font-black text-slate-700">{financeStats.cashRevenue.toFixed(2)} ر.س</p>
                       </div>

                       <div className="p-5 bg-slate-50/70 border border-slate-100 rounded-2xl text-center">
                          <p className="text-[10px] font-black text-slate-400 mb-1">شبكة / مدى 💳</p>
                          <p className="text-xl font-black text-slate-700">{financeStats.cardRevenue.toFixed(2)} ر.س</p>
                       </div>

                       <div className="p-5 bg-slate-50/70 border border-slate-100 rounded-2xl text-center">
                          <p className="text-[10px] font-black text-slate-400 mb-1">تحويل بنكي 🏦</p>
                          <p className="text-xl font-black text-slate-700">{financeStats.transferRevenue.toFixed(2)} ر.س</p>
                       </div>

                    </div>
                 </div>

              </div>

              {/* Treasury summary / quick list status metadata */}
              <div className="bg-[#1E1B4B] text-white rounded-[2.5rem] p-10 shadow-2xl flex flex-col justify-between">
                 <div className="space-y-6">
                    <h3 className="text-xl font-black flex items-center gap-3">
                       <Wallet className="text-indigo-400" />
                       خلاصة الفترة المحددة
                    </h3>
                    
                    <div className="border-b border-white/10 pb-4">
                       <p className="text-[10px] font-black text-indigo-200 mb-1">إجمالي طلبات الفترة</p>
                       <p className="text-2xl font-black text-white">{financeStats.totalOrdersCount} طلب</p>
                    </div>

                    <div className="border-b border-white/10 pb-4">
                       <p className="text-[10px] font-black text-emerald-300 mb-1">عدد الطلبات المدفوعة</p>
                       <p className="text-2xl font-black text-emerald-400">{financeStats.paidOrdersCount} طلب مدفوع</p>
                    </div>

                    <div className="pb-4">
                       <p className="text-[10px] font-black text-red-300 mb-1">عدد الطلبات المعلقة</p>
                       <p className="text-2xl font-black text-red-400">{financeStats.pendingOrdersCount} طلب معلق</p>
                    </div>
                 </div>
                 
                 <div className="text-[10px] text-slate-400 font-bold bg-white/5 p-4 rounded-2xl text-center mt-6">
                    تتغير أرقام "خلاصة الفترة" تلقائياً عند تعديل الفلاتر ونشاط المبيعات
                 </div>
              </div>

            </div>

            {/* Client Sales statistics detailed list */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
               <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-8 border-b border-slate-50 pb-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between w-full xl:w-auto gap-4">
                     <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                           <User className="text-indigo-600" size={22} />
                           إحصائيات مبيعات العملاء (أعلى تكرار وطلب)
                        </h3>
                        <p className="text-xs font-bold text-slate-400 mt-1">قائمة العملاء مع مبيعات واستهلاكات الطلبات للفترة المختارة</p>
                     </div>
                     <div className="flex flex-wrap gap-2.5">
                        <button
                           onClick={downloadGeneralExcel}
                           className="py-2 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm"
                        >
                           <FileSpreadsheet size={15} />
                           تقرير إكسل 📥
                        </button>
                        <button
                           onClick={downloadGeneralPDF}
                           className="py-2 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-sm"
                        >
                           <FileText size={15} />
                           تقرير PDF 📄
                        </button>
                     </div>
                  </div>
                  
                  {/* Search Bar for Clients */}
                  <div className="relative w-full xl:w-80">
                     <input
                        type="text"
                        placeholder="ابحث عن العميل بالاسم أو رقم الهاتف..."
                        value={financeClientSearch}
                        onChange={(e) => setFinanceClientSearch(e.target.value)}
                        className="w-full pl-5 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-bold text-xs text-right transition-all focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500"
                     />
                     <Search size={16} className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-400" />
                  </div>
               </div>

               {/* Clients table */}
               {(() => {
                 const searchedClients = financeStats.clientList.filter(c => {
                   if (financePendingFilter === 'has_pending' && c.pendingSpent <= 0) return false;
                   if (financePendingFilter === 'no_pending' && c.pendingSpent > 0) return false;
                   if (!financeClientSearch.trim()) return true;
                   const query = financeClientSearch.toLowerCase();
                   return c.name.toLowerCase().includes(query) || c.phone.includes(query);
                 });

                 if (searchedClients.length === 0) {
                   return (
                     <div className="text-center py-16 text-slate-400 font-bold bg-slate-50/50 rounded-3xl p-6">
                        لا توجد إحصائيات عملاء تطابق فلاتر البحث والوقت المحددة حالياً.
                     </div>
                   );
                 }

                 return (
                   <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-right divide-y divide-slate-100">
                         <thead>
                            <tr className="text-slate-400 text-xs font-black">
                               <th className="pb-4 font-black">العميل</th>
                               <th className="pb-4 font-black">رقم الجوال</th>
                               <th className="pb-4 font-black text-center">عدد الطلبات</th>
                               <th className="pb-4 font-black text-center">إجمالي المحصل</th>
                               <th className="pb-4 font-black text-center">إجمالي المعلق</th>
                               <th className="pb-4 font-black text-center">باقة الاشتراك 🎟️</th>
                               <th className="pb-4 font-black text-center">الرصيد المتبقي 👚</th>
                               <th className="pb-4 font-black text-center">حالة الصلاحية</th>
                               <th className="pb-4 font-black text-center">تاريخ آخر معاملة</th>
                               <th className="pb-4 font-black text-left pl-4">تحميل كشف الحساب 📊</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-50/60">
                            {searchedClients.map((client, idx) => (
                               <tr key={idx} className="hover:bg-slate-50/40 transition-all font-bold">
                                  <td className="py-4">
                                     <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                                           {client.name[0] || '👤'}
                                        </div>
                                        <span className="font-bold text-slate-800 text-sm">{client.name}</span>
                                     </div>
                                  </td>
                                  <td className="py-4 text-xs font-mono text-slate-500">{client.phone}</td>
                                  <td className="py-4 text-center text-xs text-slate-700">{client.totalOrders}</td>
                                  <td className="py-4 text-center">
                                     <span className="py-1 px-3 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black">
                                        {client.totalSpent.toFixed(2)} ر.س
                                     </span>
                                  </td>
                                  <td className="py-4 text-center">
                                     {client.pendingSpent > 0 ? (
                                        <span className="py-1 px-3 bg-red-50 text-red-700 rounded-full text-xs font-black">
                                           {client.pendingSpent.toFixed(2)} ر.س
                                        </span>
                                     ) : (
                                        <span className="text-xs text-slate-300 font-bold">-</span>
                                     )}
                                  </td>
                                  <td className="py-4 text-center">
                                     {client.hasSubscription ? (
                                        <span className="py-1 px-2.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black">
                                           {client.subscriptionPlanName}
                                        </span>
                                     ) : (
                                        <span className="text-xs text-slate-300 font-bold">بدون اشتراك</span>
                                     )}
                                  </td>
                                  <td className="py-4 text-center">
                                     {client.hasSubscription ? (
                                        <span className="font-mono text-xs text-slate-700 bg-slate-50 py-1 px-2 rounded-lg">
                                           {client.itemsRemaining} / {client.totalItems} قطعة
                                        </span>
                                     ) : (
                                        <span className="text-xs text-slate-300 font-bold">-</span>
                                     )}
                                  </td>
                                  <td className="py-4 text-center">
                                     {client.hasSubscription ? (
                                        client.subscriptionIsActive ? (
                                           <span className="py-1 px-2.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black inline-flex flex-col items-center">
                                              <span>نشط ✅</span>
                                              <span className="text-[9px] opacity-75 font-bold">تنتهي {safeFormatDate(client.subscriptionExpiry)}</span>
                                           </span>
                                        ) : (
                                           <span className="py-1 px-2.5 bg-red-50 text-red-700 rounded-full text-[10px] font-black inline-flex flex-col items-center">
                                              <span>منتهي ⚠️</span>
                                              <span className="text-[9px] opacity-75 font-bold">انتهى {safeFormatDate(client.subscriptionExpiry)}</span>
                                           </span>
                                        )
                                     ) : (
                                        <span className="text-xs text-slate-300 font-bold">-</span>
                                     )}
                                  </td>
                                  <td className="py-4 text-center text-[11px] text-slate-400">
                                     {client.lastOrderDate ? new Date(client.lastOrderDate).toLocaleDateString('ar-SA', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                     }) : 'لا توجد طلبات'}
                                  </td>
                                  <td className="py-4 text-left pl-4">
                                     <div className="flex items-center justify-end gap-2">
                                        <button
                                           onClick={() => downloadCustomerExcel(client.phone, client.name)}
                                           title="تنزيل كشف الحساب Excel"
                                           className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-xl text-xs transition-all flex items-center justify-center shrink-0 shadow-sm"
                                        >
                                           <FileSpreadsheet size={15} />
                                        </button>
                                        <button
                                           onClick={() => downloadCustomerPDF(client.phone, client.name)}
                                           title="تنزيل كشف الحساب PDF"
                                           className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs transition-all flex items-center justify-center shrink-0 shadow-sm"
                                        >
                                           <FileText size={15} />
                                        </button>
                                     </div>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                 );
               })()}
            </div>

          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            {isCreatingUser ? (
              /* Dedicated New Page Sub-view for Creating User */
              <div className="max-w-2xl mx-auto space-y-6 text-right animate-in slide-in-from-left-4 duration-500">
                <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => setIsCreatingUser(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs transition-all flex items-center gap-2"
                  >
                    <ArrowRight size={16} /> العودة لقائمة المستخدمين
                  </button>
                  <h3 className="text-xl font-black flex items-center gap-2 text-indigo-950">
                    <UserPlus className="text-indigo-600 font-bold" size={20} /> إنشاء حساب مستخدم جديد
                  </h3>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 mt-1">قم بإنشاء حساب موظف أو مشرف جديد وربطه بالمغسلة فوراً وحدد صلاحيات وصول الصفحات</p>
                  </div>

                  <form onSubmit={handleCreateStaffAccount} className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">الاسم الكامل</label>
                      <input
                        type="text"
                        placeholder="اسم الموظف"
                        required
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all text-right"
                        value={newStaffForm.full_name}
                        onChange={e => setNewStaffForm({...newStaffForm, full_name: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">البريد الإلكتروني</label>
                      <input
                        type="email"
                        placeholder="email@laundry.com"
                        required
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all text-left"
                        dir="ltr"
                        value={newStaffForm.email}
                        onChange={e => setNewStaffForm({...newStaffForm, email: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">كلمة المرور</label>
                      <input
                        type="password"
                        placeholder="كلمة المرور (6 خانات على الأقل)"
                        required
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all text-left"
                        dir="ltr"
                        value={newStaffForm.password}
                        onChange={e => setNewStaffForm({...newStaffForm, password: e.target.value})}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">صلاحية النظام الافتراضية</label>
                      <select
                        className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-xs transition-all"
                        value={newStaffForm.role}
                        onChange={e => {
                          const nextRole = e.target.value as UserRole;
                          setNewStaffForm({
                            ...newStaffForm, 
                            role: nextRole,
                            // Set standard fallback permissions for that role initially
                            permissions: ROLE_PERMISSIONS[nextRole] || []
                          });
                        }}
                      >
                        <option value="staff">موظف (Staff)</option>
                        <option value="manager">مشرف مغسلة (Manager)</option>
                        <option value="admin">مدير نظام عام (Admin)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">المغسلة المرتبطة</label>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-xs transition-all"
                          value={newStaffForm.laundry_id}
                          onChange={e => {
                            const selectedLaundry = laundries.find(l => l.id === e.target.value);
                            setNewStaffForm({
                              ...newStaffForm,
                              laundry_id: e.target.value,
                              laundry_name: selectedLaundry ? selectedLaundry.name : (userProfile?.laundry_name || '')
                            });
                          }}
                        >
                          <option value={userProfile?.laundry_id}>{userProfile?.laundry_name} (المغسلة الحالية)</option>
                          {laundries.filter(l => l.id !== userProfile?.laundry_id).map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={async () => {
                            const name = prompt('يرجى إدخال اسم المغسلة الجديدة:');
                            if (name && name.trim()) {
                              const newId = ensureUUID(Math.random().toString(36).substring(2, 15));
                              const added = await addLaundryToPlatform(newId, name.trim());
                              if (added) {
                                setNewStaffForm(prev => ({
                                  ...prev,
                                  laundry_id: newId,
                                  laundry_name: name.trim()
                                }));
                                alert('تمت إضافة المغسلة الجديدة وتحديدها بنجاح! 🎉');
                              } else {
                                alert('المغسلة موجودة بالفعل أو حدث خطأ أثناء الإضافة.');
                              }
                            }
                          }}
                          className="px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl border border-indigo-200 text-xs font-black transition-all"
                        >
                          + مغسلة جديدة
                        </button>
                      </div>
                    </div>

                    {/* Page permissions selection checkboxes */}
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                      <label className="block text-xs font-black text-slate-600 flex items-center gap-1.5">
                        <Settings2 size={14} className="text-indigo-600" /> تحديد الصفحات المسموحة (Page Access)
                      </label>
                      <p className="text-[10px] text-slate-400 font-bold mb-3">اختر الصفحات المعينة التي يمكن لهذا الموظف الدخول إليها:</p>
                      <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                        {navItems.map(item => {
                          const IconComponent = item.icon;
                          const isChecked = newStaffForm.permissions.includes(item.id);
                          return (
                            <label key={item.id} className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${isChecked ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-black' : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-500'}`}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  const newPerms = isChecked
                                    ? newStaffForm.permissions.filter(p => p !== item.id)
                                    : [...newStaffForm.permissions, item.id];
                                  setNewStaffForm({...newStaffForm, permissions: newPerms});
                                }}
                                className="accent-indigo-600 rounded"
                              />
                              <span className="text-[11px] font-bold flex items-center gap-1">
                                <IconComponent size={12} className={isChecked ? "text-indigo-600" : "text-slate-400"} />
                                {item.label}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={createStaffLoading}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {createStaffLoading ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <>
                          <UserPlus size={18} /> إنشاء الحساب وتعيينه
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* Spacious, Beautiful Table View of Accounts */
              <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100 space-y-6 text-right">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-3 text-indigo-950">
                      <ShieldCheck className="text-indigo-600" /> إدارة المستخدمين والصلاحيات والمغاسل
                    </h3>
                    <p className="text-xs font-bold text-slate-400 mt-1">تعديل صلاحيات الموظفين، ربطهم بالمغسلة الحالية، وتحديد وصول الصفحات</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsCreatingUser(true)}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-md hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <UserPlus size={16} /> إضافة مستخدم جديد
                    </button>
                    <button onClick={fetchProfiles} className="p-3 bg-slate-50 rounded-xl text-slate-500 hover:text-indigo-600 transition-all">
                      <Repeat size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-black text-slate-400 text-sm">المستخدم</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">البريد الإلكتروني</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الصلاحية</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">المغسلة المرتبطة</th>
                        <th className="pb-4 font-black text-slate-400 text-sm">الصفحات المتاحة</th>
                        <th className="pb-4 font-black text-slate-400 text-sm text-left pl-4">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {profiles.map(profile => (
                        <tr key={profile.id} className="group hover:bg-slate-50/50 transition-all">
                          <td className="py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-black">
                                {profile.full_name?.[0] || profile.email?.[0].toUpperCase()}
                              </div>
                              <span className="font-black text-slate-800">{profile.full_name || 'بدون اسم'}</span>
                            </div>
                          </td>
                          <td className="py-6 text-sm font-bold text-slate-500">{profile.email}</td>
                          <td className="py-6">
                            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black ${
                              profile.role === 'admin' ? 'bg-indigo-100 text-indigo-700' :
                              profile.role === 'manager' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {profile.role === 'admin' ? 'مدير نظام' : profile.role === 'manager' ? 'مشرف' : 'موظف'}
                            </span>
                          </td>
                          <td className="py-6 text-sm font-black text-slate-700">
                            {profile.laundry_name || 'بدون مغسلة'}
                          </td>
                          <td className="py-6">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {(() => {
                                const perms = (profile.permissions !== undefined && profile.permissions !== null)
                                  ? profile.permissions
                                  : (ROLE_PERMISSIONS[profile.role] || []);
                                return perms.map(pId => {
                                  const item = navItems.find(n => n.id === pId);
                                  if (!item) return null;
                                  return (
                                    <span key={pId} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] rounded-md font-bold flex items-center gap-1">
                                      {item.label}
                                    </span>
                                  );
                                });
                              })()}
                            </div>
                          </td>
                          <td className="py-6 text-left pl-4 flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingUserProfile(profile);
                                setEditingUserForm({
                                  full_name: profile.full_name || '',
                                  role: profile.role || 'staff',
                                  laundry_id: profile.laundry_id || '',
                                  laundry_name: profile.laundry_name || '',
                                  permissions: (profile.permissions !== undefined && profile.permissions !== null)
                                    ? profile.permissions 
                                    : ROLE_PERMISSIONS[profile.role] || []
                                });
                              }}
                              className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-700 rounded-lg transition-all"
                              title="تعديل المستخدم وصلاحياته"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button
                              onClick={() => setUserToDelete(profile)}
                              disabled={profile.id === session?.user?.id}
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                              title="حذف المستخدم"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* Laundry Subscription Control Card */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl border border-slate-100 text-right overflow-hidden relative">
              {/* Top Accent Gradient */}
              <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600"></div>

              {/* Header */}
              <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner shrink-0">
                    <CreditCard size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-slate-900">إدارة اشتراك مغسلتك</h3>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-100 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        نظام مفعل
                      </span>
                    </div>
                    <p className="text-slate-400 font-bold text-xs mt-1">متابعة باقة المغسلة، حالة الحساب، وتجديد الاشتراك في المنصة</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowSaaSPaymentModal(true)}
                  className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                >
                  <Sparkles size={16} /> تجديد اشتراك المغسلة الحالي
                </button>
              </div>

              {/* Status Overview Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase">الباقة النشطة</span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-lg font-black text-slate-800">الباقة السحابية الشاملة</span>
                    <span className="text-base">🏆</span>
                  </div>
                </div>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase">حالة الباقة</span>
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black ${
                      userProfile?.saas_status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                      userProfile?.saas_status === 'trial' ? 'bg-amber-100 text-amber-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {userProfile?.saas_status === 'active' ? 'نشط ✅' :
                       userProfile?.saas_status === 'trial' ? 'فترة تجريبية ⏳' : 'منتهي الصلاحية ⚠️'}
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase">تاريخ التجديد القادم</span>
                  <p className="text-base font-black text-indigo-900 mt-2">
                    {userProfile?.saas_expiry && !isNaN(new Date(userProfile.saas_expiry).getTime()) ? new Date(userProfile.saas_expiry).toLocaleDateString('ar-SA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'مستمر (غير محدود)'}
                  </p>
                </div>
              </div>

              {/* Subscription Details Box */}
              <div className="p-8 bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-indigo-50/40 rounded-3xl border border-indigo-100">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="text-right space-y-3 flex-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-800 rounded-xl text-xs font-black">
                      <Zap size={14} className="text-indigo-600" /> الباقة الموصى بها لمغسلتك
                    </div>
                    <h4 className="text-xl font-black text-indigo-950">الباقة السحابية الشاملة للمغاسل</h4>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">
                      تتضمن كافة أدوات إدارة الكاشير، المبيعات، العمالة، المخزون، والتقارير المالية المتقدمة
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white/80 backdrop-blur-sm p-2.5 rounded-xl border border-indigo-100/60">
                        <Check size={16} className="text-emerald-500 shrink-0" />
                        <span>إدارة طلبات وكاشير غير محدودة</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white/80 backdrop-blur-sm p-2.5 rounded-xl border border-indigo-100/60">
                        <Check size={16} className="text-emerald-500 shrink-0" />
                        <span>ربط واستهلاك أوتوماتيكي للمخزون</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white/80 backdrop-blur-sm p-2.5 rounded-xl border border-indigo-100/60">
                        <Check size={16} className="text-emerald-500 shrink-0" />
                        <span>تقارير مالية وتصدير Excel/PDF</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white/80 backdrop-blur-sm p-2.5 rounded-xl border border-indigo-100/60">
                        <Check size={16} className="text-emerald-500 shrink-0" />
                        <span>دعم الفواتير الضريبية وطباعة الباركود</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm text-center shrink-0 w-full md:w-56 space-y-3">
                    <p className="text-xs font-black text-slate-400">سعر الاشتراك</p>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-black text-indigo-600">199</span>
                      <span className="text-xs font-bold text-slate-500">ريال / شهرياً</span>
                    </div>
                    <button
                      onClick={() => setShowSaaSPaymentModal(true)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-black text-xs transition-all shadow-md"
                    >
                      تجديد الاشتراك الآن
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          true ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4">
               {[
                 { label: 'صافي الدخل', value: `${stats.totalRevenue.toFixed(2)} ر.س`, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                 { label: 'طلبات جارية', value: stats.pendingOrdersCount, icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                 { label: 'مبالغ معلقة', value: `${stats.pendingAmount.toFixed(2)} ر.س`, icon: Wallet, color: 'text-orange-600', bg: 'bg-orange-50' },
                 { label: 'نقص المخزون', value: stats.lowStockCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
               ].map((s, i) => (
                 <div key={i} className="bg-white p-6 rounded-[2rem] border shadow-sm group hover:scale-105 transition-all">
                   <div className={`p-4 ${s.bg} ${s.color} rounded-2xl w-fit mb-4`}><s.icon size={24} /></div>
                   <p className="text-slate-400 text-[10px] font-black uppercase mb-1">{s.label}</p>
                   <p className="text-2xl font-black text-slate-800">{s.value}</p>
                 </div>
               ))}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-[2.5rem] border shadow-sm text-center animate-in fade-in">
              <ShieldCheck size={48} className="mx-auto text-indigo-600 mb-4 opacity-20" />
              <h3 className="text-xl font-black text-slate-800 mb-2">مرحباً بك في نظام مغلسة نظافة وعود</h3>
              <p className="text-slate-500 font-medium">استخدم القائمة الجانبية للبدء في معالجة الطلبات.</p>
            </div>
          )
        )}
      </main>

      {/* Modals */}
      {showPackageModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">{editingPackageId ? 'تعديل باقة الاشتراك' : 'إنشاء باقة اشتراك جديدة'}</h3>
              <button 
                onClick={() => { 
                  setShowPackageModal(false); 
                  setEditingPackageId(null); 
                  setPackageForm({ name: '', total_items: 0, price: 0, duration_days: 30, discount_percent: 0, isUnlimitedDays: false }); 
                }} 
                className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">اسم الباقة</label>
                <input 
                  type="text" 
                  placeholder="مثال: الباقة البرونزية" 
                  className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                  value={packageForm.name} 
                  onChange={e => setPackageForm({...packageForm, name: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">عدد القطع</label>
                  <input 
                    type="number" 
                    placeholder="30" 
                    className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                    value={packageForm.total_items} 
                    onChange={e => setPackageForm({...packageForm, total_items: e.target.value})} 
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-400 uppercase">السعر (ريال)</label>
                    <button
                      type="button"
                      onClick={() => setPackageForm({ ...packageForm, price: 0 })}
                      className="text-[10px] font-black text-indigo-600 hover:underline"
                    >
                      مجاني (0)
                    </button>
                  </div>
                  <input 
                    type="number" 
                    placeholder="150" 
                    className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                    value={packageForm.price} 
                    onChange={e => setPackageForm({...packageForm, price: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                {/* Duration Column */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-slate-400 uppercase">المدة (أيام)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const isCurrentlyUnlimited = packageForm.isUnlimitedDays || packageForm.duration_days === 0 || packageForm.duration_days === '0';
                        const nextUnlimited = !isCurrentlyUnlimited;
                        setPackageForm({
                          ...packageForm,
                          isUnlimitedDays: nextUnlimited,
                          duration_days: nextUnlimited ? 0 : 30
                        });
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 border ${
                        packageForm.isUnlimitedDays || packageForm.duration_days === 0 || packageForm.duration_days === '0'
                          ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      <span>♾️ لا محدود</span>
                    </button>
                  </div>

                  {packageForm.isUnlimitedDays || packageForm.duration_days === 0 || packageForm.duration_days === '0' ? (
                    <div className="w-full px-3 py-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 font-black text-xs">
                      <span>لا محدود</span>
                      <button
                        type="button"
                        onClick={() => setPackageForm({ ...packageForm, isUnlimitedDays: false, duration_days: 30 })}
                        className="text-[10px] text-indigo-600 hover:underline font-bold"
                      >
                        أيام
                      </button>
                    </div>
                  ) : (
                    <input 
                      type="number" 
                      placeholder="30" 
                      className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                      value={packageForm.duration_days} 
                      onChange={e => setPackageForm({...packageForm, duration_days: e.target.value, isUnlimitedDays: false})} 
                    />
                  )}
                </div>

                {/* Discount Column */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">الخصم (%)</label>
                  <input 
                    type="number" 
                    placeholder="الخصم (%)" 
                    className="w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none font-bold text-slate-800 focus:border-indigo-500 transition-all" 
                    value={packageForm.discount_percent} 
                    onChange={e => setPackageForm({...packageForm, discount_percent: e.target.value})} 
                  />
                </div>
              </div>

              <button onClick={handleCreatePackage} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black mt-4 transition-all shadow-lg shadow-indigo-100">
                {editingPackageId ? 'حفظ التعديلات' : 'حفظ الباقة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isInvModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0 border-b border-slate-100 pb-4">
              <h3 className="text-xl font-black text-indigo-950">إضافة مادة جديدة للمخزون</h3>
              <button onClick={() => { setIsInvModalOpen(false); setNewInvConsumption({}); }} className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-red-500 transition-all"><X size={20} /></button>
            </div>
            <div className="space-y-4 overflow-y-auto custom-scrollbar pr-1 pl-1 flex-1">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">اختر من القائمة المسبقة أو مادة مخصصة</label>
                <select
                  className="w-full px-5 py-4 bg-indigo-50/60 border border-indigo-100 rounded-2xl outline-none font-bold text-sm text-indigo-900 cursor-pointer focus:ring-2 focus:ring-indigo-500/20"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setNewInvItem({ name: '', stock: 0, unit: 'قطعة', threshold: 5, defaultConsumption: 10 });
                      setNewInvConsumption({});
                    } else {
                      const found = PRESET_INVENTORY_ITEMS.find(p => p.name === val);
                      if (found) {
                        const defVal = found.threshold || 10;
                        setNewInvItem({
                          name: found.name,
                          stock: found.stock,
                          unit: found.unit,
                          threshold: found.threshold,
                          defaultConsumption: defVal
                        });
                        setNewInvConsumption({});
                      }
                    }
                  }}
                  defaultValue="custom"
                >
                  <option value="custom">✨ مادة جديدة مخصصة...</option>
                  {PRESET_INVENTORY_ITEMS.map((item, idx) => (
                    <option key={idx} value={item.name}>
                      {item.name} ({item.stock} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase">اسم المادة</label>
                <input type="text" placeholder="مثال: صابون سائل" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-850" value={newInvItem.name} onChange={e => setNewInvItem({...newInvItem, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">الكمية الحالية</label>
                  <input type="number" placeholder="0" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={newInvItem.stock || ''} onChange={e => setNewInvItem({...newInvItem, stock: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">الوحدة</label>
                  <input type="text" placeholder="قطعة / مل / كيس" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={newInvItem.unit} onChange={e => setNewInvItem({...newInvItem, unit: e.target.value})} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">حد التنبيه</label>
                  <input type="number" placeholder="5" className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold" value={newInvItem.threshold || ''} onChange={e => setNewInvItem({...newInvItem, threshold: parseInt(e.target.value) || 0})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase">عدد القطع للاستهلاك (لكل غسلة/طلب)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    min="0"
                    placeholder="10" 
                    className="w-full px-5 py-4 bg-indigo-50/50 border border-indigo-100 text-indigo-900 rounded-2xl outline-none font-bold" 
                    value={newInvItem.defaultConsumption === undefined ? '' : newInvItem.defaultConsumption} 
                    onChange={e => setNewInvItem({...newInvItem, defaultConsumption: parseFloat(e.target.value) || 0})} 
                  />
                </div>
              </div>

              {/* Linked Laundry Categories (أصناف كاشير جديد) */}
              <div className="pt-2 text-right space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-black text-slate-600 block">
                    ربط المواد الاستهلاكية (الكمية المستهلكة من المخزون لكل صنف)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => {
                        const defVal = newInvItem.defaultConsumption !== undefined ? newInvItem.defaultConsumption : 10;
                        const updatedMap: Record<string, number> = {};
                        const catList = categories.length > 0 ? categories : INITIAL_ITEMS;
                        catList.forEach(c => { updatedMap[c.name] = defVal; });
                        setNewInvConsumption(updatedMap);
                      }}
                      className="text-[10px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition-all"
                    >
                      تطبيق على الجميع ⚡
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setNewInvConsumption({})}
                      className="text-[10px] font-black text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-xl transition-all"
                    >
                      إلغاء الكل ❌
                    </button>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                  حدد الأصناف والكمية التي سيتم خصمها تلقائياً عند اختيار الصنف في الكاشير:
                </p>
                <div className="max-h-52 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 custom-scrollbar">
                  {(categories.length > 0 ? categories : INITIAL_ITEMS).map(cat => {
                    const currentConsVal = newInvConsumption[cat.name] || 0;
                    const isSelected = currentConsVal > 0;
                    return (
                      <div 
                        key={cat.name} 
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition-all ${
                          isSelected ? 'bg-indigo-50/50 border-indigo-200 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              const toggleVal = isSelected ? 0 : (newInvItem.defaultConsumption || 10);
                              setNewInvConsumption(prev => ({
                                ...prev,
                                [cat.name]: toggleVal
                              }));
                            }}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                              isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-100 border-slate-300 text-transparent hover:border-indigo-400'
                            }`}
                          >
                            <Check size={12} />
                          </button>
                          <span className="text-sm">{cat.icon || '👕'}</span>
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-slate-800">{cat.name}</span>
                            <span className="text-[9px] font-bold text-slate-400">الوحدة: {newInvItem.unit || 'قطعة'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            placeholder="0 (غير مرتبط)" 
                            className="w-20 px-2 py-1.5 text-center font-black text-xs bg-white border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-indigo-500"
                            value={currentConsVal === 0 ? '' : currentConsVal}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setNewInvConsumption(prev => ({
                                ...prev,
                                [cat.name]: val
                              }));
                            }}
                          />
                          <span className="text-[10px] font-bold text-slate-400">{newInvItem.unit || 'قطعة'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={handleAddInventoryItem} 
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black mt-4 flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100 shrink-0"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> حفظ المادة وربط الاستهلاك</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignSubModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black">تفعيل اشتراك للعميل</h3>
              <button onClick={() => setShowAssignSubModal(null)} className="p-2 bg-slate-100 rounded-xl text-slate-500"><X size={20} /></button>
            </div>
            <div className="mb-8 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <p className="text-sm font-black text-indigo-900">{showAssignSubModal.name}</p>
              <p className="text-xs font-bold text-indigo-600">{showAssignSubModal.phone}</p>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase mb-2">اختر الباقة المناسبة</p>
              {subscriptionPackages.map(pkg => (
                <button 
                  key={pkg.id} 
                  onClick={() => handleAssignSubscription(pkg.id)}
                  className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-50 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                >
                  <div className="text-right">
                    <p className="font-black text-slate-800 group-hover:text-indigo-900">{pkg.name}</p>
                    <p className="text-xs font-bold text-slate-400">
                      {pkg.total_items} قطعة - {pkg.duration_days === 0 || pkg.duration_days >= 36500 ? 'لا محدود' : `${pkg.duration_days} يوم`}
                    </p>
                  </div>
                  <p className="font-black text-indigo-600">{pkg.price === 0 ? 'مجاني' : `${pkg.price} ريال`}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCustomItemModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-6">
                 <h3 className="text-xl font-black">صنف مخصص جديد</h3>
                 <button onClick={() => { setShowCustomItemModal(false); setShowIconPicker(false); }} className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-all"><X size={20} /></button>
              </div>
              <div className="space-y-4 mb-6 text-right">
                <div>
                  <label className="text-xs font-black text-slate-400 block mb-1">اسم الصنف</label>
                  <input 
                    type="text" 
                    placeholder="مثال: بطانية كبير" 
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-slate-850 text-right" 
                    value={customItemForm.name} 
                    onChange={e => setCustomItemForm({...customItemForm, name: e.target.value})} 
                  />
                </div>

                {/* Icon Selection */}
                <div className="relative">
                  <label className="text-xs font-black text-slate-400 block mb-1">أيقونة الصنف</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      placeholder="أدخل رمز/إيموجي..." 
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 text-center text-sm" 
                      value={customItemForm.icon} 
                      onChange={e => setCustomItemForm({...customItemForm, icon: e.target.value})} 
                    />
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(!showIconPicker)}
                      className="px-3 py-3 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-2xl text-xs font-black text-slate-600 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Smile size={16} className="text-indigo-600" />
                      <span>قائمة الأيقونات</span>
                    </button>
                  </div>

                  {/* Icon Picker Popover Dropdown */}
                  {showIconPicker && (
                    <div className="absolute top-full right-0 mt-2 z-[250] bg-white border border-slate-200 rounded-3xl p-3 shadow-2xl w-full animate-in fade-in zoom-in-95">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[11px] font-black text-slate-500">اختر إيموجي الصنف:</span>
                        <button 
                          type="button" 
                          onClick={() => setShowIconPicker(false)}
                          className="text-slate-400 hover:text-red-500 text-xs font-bold p-1"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1 bg-slate-50/50 rounded-2xl border border-slate-100">
                        {PRESET_CUSTOM_ICONS.map((ic, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setCustomItemForm({...customItemForm, icon: ic});
                              setShowIconPicker(false);
                            }}
                            className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all ${
                              customItemForm.icon === ic 
                                ? 'bg-indigo-600 text-white scale-110 shadow-md ring-2 ring-indigo-300' 
                                : 'bg-white hover:bg-indigo-50 border border-slate-100 text-slate-700'
                            }`}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-black text-slate-400 block mb-1">السعر العادي (أساسي)</label>
                  <input 
                    type="number" 
                    placeholder="السعر الرئيسي" 
                    className="w-full px-5 py-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none font-black text-indigo-700 text-right" 
                    value={customItemForm.price === 0 ? '0' : (customItemForm.price || '')} 
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                      setCustomItemForm({
                        ...customItemForm, 
                        price: val
                      });
                    }} 
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block mb-1 text-center">عادي</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-black text-center text-slate-700 font-bold" 
                      value={customItemForm.price_normal === 0 ? '0' : (customItemForm.price_normal || '')} 
                      onChange={e => setCustomItemForm({...customItemForm, price_normal: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-red-500 block mb-1 text-center">مستعجل 🔥</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-2 py-3 bg-red-50/20 border border-red-100 rounded-xl outline-none font-black text-center text-red-600" 
                      value={customItemForm.price_urgent === 0 ? '0' : (customItemForm.price_urgent || '')} 
                      onChange={e => setCustomItemForm({...customItemForm, price_urgent: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-600 block mb-1 text-center">كوي</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-2 py-3 bg-indigo-50/20 border border-indigo-100 rounded-xl outline-none font-black text-center text-indigo-600" 
                      value={customItemForm.price_ironing === 0 ? '0' : (customItemForm.price_ironing || '')} 
                      onChange={e => setCustomItemForm({...customItemForm, price_ironing: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                    />
                  </div>
                </div>
                
                <div className="pt-2">
                  <label className="text-xs font-black text-slate-400 block mb-2">ربط المواد الاستهلاكية (الكمية المستهلكة من المخزون)</label>
                  <div className="max-h-36 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 custom-scrollbar">
                    {inventory.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-100">
                        <div className="flex flex-col text-right">
                          <span className="text-xs font-black text-slate-800">{inv.name}</span>
                          <span className="text-[9px] font-bold text-slate-400">الوحدة: {inv.unit} (مخزون: {inv.stock})</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input 
                            type="number" 
                            step="0.1" 
                            min="0"
                            placeholder="0 (لا يوجد)" 
                            className="w-20 px-2 py-1 text-center font-black text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800"
                            value={customItemConsumptions[inv.id] || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setCustomItemConsumptions(prev => ({
                                ...prev,
                                [inv.id]: val
                              }));
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {inventory.length === 0 && (
                      <p className="text-xs font-bold text-slate-400 text-center py-2">لا توجد مواد مضافة في المخزون حالياً</p>
                    )}
                  </div>
                </div>
              </div>
              <button 
                type="button"
                disabled={isAddingCustomItem}
                onClick={handleAddCustomItem} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isAddingCustomItem ? 'جاري الإضافة...' : 'إضافة للسلة'}
              </button>
           </div>
        </div>
      )}

      {/* Editing Category Popup Modal */}
      {editingCategoryModalIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-slate-900">تعديل الصنف</h3>
              <button 
                type="button"
                onClick={() => setEditingCategoryModalIndex(null)} 
                className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6 text-right">
              {/* Name Input */}
              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">اسم الصنف</label>
                <input 
                  type="text"
                  placeholder="مثال: بطانية كبير" 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-slate-850 text-right focus:border-indigo-500 focus:bg-white transition-all" 
                  value={editingCategoryForm.name} 
                  onChange={e => setEditingCategoryForm({...editingCategoryForm, name: e.target.value})} 
                />
              </div>

              {/* Icon Selection */}
              <div className="relative">
                <label className="text-xs font-black text-slate-400 block mb-1">أيقونة الصنف</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    placeholder="أدخل رمز/إيموجي..." 
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 text-center text-sm focus:border-indigo-500 focus:bg-white transition-all" 
                    value={editingCategoryForm.icon} 
                    onChange={e => setEditingCategoryForm({...editingCategoryForm, icon: e.target.value})} 
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditCategoryIconPicker(!showEditCategoryIconPicker)}
                    className="px-3 py-3 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-2xl text-xs font-black text-slate-600 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Smile size={16} className="text-indigo-600" />
                    <span>قائمة الأيقونات</span>
                  </button>
                </div>

                {/* Icon Picker Popover Dropdown */}
                {showEditCategoryIconPicker && (
                  <div className="absolute top-full right-0 mt-2 z-[250] bg-white border border-slate-200 rounded-3xl p-3 shadow-2xl w-full animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[11px] font-black text-slate-500">اختر إيموجي الصنف:</span>
                      <button 
                        type="button" 
                        onClick={() => setShowEditCategoryIconPicker(false)}
                        className="text-slate-400 hover:text-red-500 text-xs font-bold p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-8 gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1 bg-slate-50/50 rounded-2xl border border-slate-100">
                      {PRESET_CUSTOM_ICONS.map((ic, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setEditingCategoryForm({...editingCategoryForm, icon: ic});
                            setShowEditCategoryIconPicker(false);
                          }}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all cursor-pointer ${
                            editingCategoryForm.icon === ic 
                              ? 'bg-indigo-600 text-white scale-110 shadow-md ring-2 ring-indigo-300' 
                              : 'bg-white hover:bg-indigo-50 border border-slate-100 text-slate-700'
                          }`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Normal Main Base Price */}
              <div>
                <label className="text-xs font-black text-slate-400 block mb-1">السعر العادي (أساسي)</label>
                <input 
                  type="number" 
                  placeholder="السعر الرئيسي" 
                  className="w-full px-5 py-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl outline-none font-black text-indigo-700 text-right focus:border-indigo-500 focus:bg-white transition-all" 
                  value={editingCategoryForm.price_normal === 0 ? '0' : (editingCategoryForm.price_normal || '')} 
                  onChange={e => {
                    const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                    setEditingCategoryForm({
                      ...editingCategoryForm, 
                      price: val,
                      price_normal: val
                    });
                  }} 
                />
              </div>

              {/* 3 Prices Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-black text-slate-500 block mb-1 text-center">عادي</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-black text-center text-slate-700 focus:border-indigo-500 focus:bg-white transition-all" 
                    value={editingCategoryForm.price_normal === 0 ? '0' : (editingCategoryForm.price_normal || '')} 
                    onChange={e => {
                      const val = e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0);
                      setEditingCategoryForm({
                        ...editingCategoryForm, 
                        price: val,
                        price_normal: val
                      });
                    }} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-red-500 block mb-1 text-center">مستعجل 🔥</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full px-2 py-3 bg-red-50/20 border border-red-100 rounded-xl outline-none font-black text-center text-red-600 focus:border-red-400 focus:bg-white transition-all" 
                    value={editingCategoryForm.price_urgent === 0 ? '0' : (editingCategoryForm.price_urgent || '')} 
                    onChange={e => setEditingCategoryForm({...editingCategoryForm, price_urgent: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-indigo-600 block mb-1 text-center">كوي</label>
                  <input 
                    type="number" 
                    step="0.5"
                    className="w-full px-2 py-3 bg-indigo-50/20 border border-indigo-100 rounded-xl outline-none font-black text-center text-indigo-600 focus:border-indigo-400 focus:bg-white transition-all" 
                    value={editingCategoryForm.price_ironing === 0 ? '0' : (editingCategoryForm.price_ironing || '')} 
                    onChange={e => setEditingCategoryForm({...editingCategoryForm, price_ironing: e.target.value === '' ? 0 : (parseFloat(e.target.value) || 0)})} 
                  />
                </div>
              </div>

              {/* Inventory Linked Consumption */}
              <div className="pt-2">
                <label className="text-xs font-black text-slate-400 block mb-2">ربط المواد الاستهلاكية (الكمية المستهلكة من المخزون)</label>
                <div className="max-h-36 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 custom-scrollbar">
                  {inventory.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-100">
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-black text-slate-800">{inv.name}</span>
                        <span className="text-[9px] font-bold text-slate-400">الوحدة: {inv.unit} (مخزون: {inv.stock})</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input 
                          type="number" 
                          step="0.1" 
                          min="0"
                          placeholder="0 (لا يوجد)" 
                          className="w-20 px-2 py-1 text-center font-black text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-indigo-500 focus:bg-white transition-all"
                          value={editingCategoryConsumptions[inv.id] || ''}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setEditingCategoryConsumptions(prev => ({
                              ...prev,
                              [inv.id]: val
                            }));
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {inventory.length === 0 && (
                    <p className="text-xs font-bold text-slate-400 text-center py-2">لا توجد مواد مضافة في المخزون حالياً</p>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button 
                type="button"
                disabled={isSavingCategory || isDeletingCategory}
                onClick={handleSaveCategoryEdit} 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save size={18} />
                {isSavingCategory ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>

              <button 
                type="button"
                disabled={isDeletingCategory || isSavingCategory}
                onClick={async () => {
                  const targetCat = editingCategoryModalIndex !== null ? categories[editingCategoryModalIndex] : null;
                  const catId = targetCat?.id || editingCategoryForm.id;
                  const catName = targetCat?.name || editingCategoryForm.name;

                  if (!showDeleteCategoryConfirm) {
                    setShowDeleteCategoryConfirm(true);
                    return;
                  }

                  await deleteCategory({ id: catId, name: catName });
                  setEditingCategoryModalIndex(null);
                  setShowDeleteCategoryConfirm(false);
                }}
                className={`py-4 px-5 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50 ${
                  showDeleteCategoryConfirm 
                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200' 
                    : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-100'
                }`}
                title="حذف الصنف"
              >
                <Trash2 size={20} />
                {showDeleteCategoryConfirm ? 'تأكيد الحذف؟' : ''}
              </button>

              {showDeleteCategoryConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteCategoryConfirm(false)}
                  className="px-4 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editingConsumptionItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black">ربط واستهلاك المواد - {editingConsumptionItem.name}</h3>
              <button 
                onClick={() => setEditingConsumptionItem(null)} 
                className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-xs font-bold text-slate-400 mb-4 leading-relaxed text-right">
              حدد المواد الاستهلاكية التي يتم استخدامها عند غسيل أو كي هذا الصنف والكمية التي سيتم خصمها من المخزون تلقائياً عند إنشاء الطلب.
            </p>

            <div className="max-h-60 overflow-y-auto px-1 py-1 text-right space-y-3 custom-scrollbar mb-6">
              {inventory.map(inv => {
                const currentVal = inventoryConsumption[editingConsumptionItem.name]?.[inv.id] || 0;
                return (
                  <div key={inv.id} className="flex items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-black text-slate-800">{inv.name}</span>
                      <span className="text-[9px] font-bold text-slate-400">الوحدة الحالية: {inv.unit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0"
                        placeholder="0 (لا يوجد)" 
                        className="w-24 px-3 py-2 text-center font-black text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-800 focus:border-indigo-500"
                        value={currentVal === 0 ? '' : currentVal}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setInventoryConsumption(prev => {
                            const updated = { ...prev };
                            if (!updated[editingConsumptionItem.name]) {
                              updated[editingConsumptionItem.name] = {};
                            }
                            updated[editingConsumptionItem.name] = {
                              ...updated[editingConsumptionItem.name],
                              [inv.id]: val
                            };
                            localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updated));
                            syncInventoryConsumptionToDb(updated);
                            return updated;
                          });
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {inventory.length === 0 && (
                <div className="text-center py-6">
                  <p className="text-xs font-bold text-slate-400 text-center">لا توجد مواد مضافة في المخزون حالياً</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => setEditingConsumptionItem(null)} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100"
            >
              حفظ الإعدادات
            </button>
          </div>
        </div>
      )}

      {editingInvConsumptionItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 text-right" dir="rtl">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-6 shrink-0 border-b border-slate-100 pb-4">
              <div className="flex flex-col text-right">
                <h3 className="text-xl font-black text-indigo-950">ربط المادة بالأصناف - {editingInvConsumptionItem.name}</h3>
                <p className="text-xs font-bold text-slate-400">تحديد كمية الاستهلاك والخصم عند طلب أصناف كاشير جديد</p>
              </div>
              <button 
                onClick={() => setEditingInvConsumptionItem(null)} 
                className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="max-h-80 overflow-y-auto px-1 py-1 text-right space-y-2.5 custom-scrollbar mb-6 flex-1">
              {(categories.length > 0 ? categories : INITIAL_ITEMS).map(cat => {
                const currentVal = inventoryConsumption[cat.name]?.[editingInvConsumptionItem.id] || 0;
                return (
                  <div key={cat.name} className="flex items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2.5 text-right">
                      <span className="text-lg">{cat.icon || '👕'}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800">{cat.name}</span>
                        <span className="text-[10px] font-bold text-slate-400">وحدة الخصم: {editingInvConsumptionItem.unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        step="0.1" 
                        min="0"
                        placeholder="0 (غير مرتبط)" 
                        className="w-24 px-3 py-2 text-center font-black text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-800 focus:border-indigo-500"
                        value={currentVal === 0 ? '' : currentVal}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setInventoryConsumption(prev => {
                            const updated = { ...prev };
                            if (!updated[cat.name]) {
                              updated[cat.name] = {};
                            }
                            updated[cat.name] = {
                              ...updated[cat.name],
                              [editingInvConsumptionItem.id]: val
                            };
                            localStorage.setItem('laundry_inventory_consumption', JSON.stringify(updated));
                            syncInventoryConsumptionToDb(updated);
                            return updated;
                          });
                        }}
                      />
                      <span className="text-xs font-bold text-slate-400">{editingInvConsumptionItem.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              onClick={() => setEditingInvConsumptionItem(null)} 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-indigo-100 shrink-0"
            >
              حفظ الربط والتثبيت
            </button>
          </div>
        </div>
      )}

      {showEditOrderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden text-right" dir="rtl">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white z-10 shrink-0">
              <h3 className="text-2xl font-black text-indigo-950">تعديل الطلب #{showEditOrderModal.order_number}</h3>
              <button onClick={() => setShowEditOrderModal(null)} className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-red-500 transition-all"><X size={24} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Side: Order & Customer Settings */}
                <div className="lg:col-span-5 space-y-6">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider border-b pb-2">بيانات العميل والفاتورة</h4>
                  
                  {/* Customer Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase mb-2">اسم العميل</label>
                      <div className="relative">
                        <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="اسم العميل"
                          className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-indigo-500 transition-all"
                          value={showEditOrderModal.customer_name}
                          onChange={e => setShowEditOrderModal({...showEditOrderModal, customer_name: e.target.value})}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase mb-2">رقم الهاتف (الواتساب)</label>
                      <div className="relative text-left">
                        <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          dir="ltr"
                          placeholder="رقم الهاتف"
                          className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-indigo-500 transition-all text-left"
                          value={showEditOrderModal.customer_phone}
                          onChange={e => setShowEditOrderModal({...showEditOrderModal, customer_phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Customer Subscription Info & Association */}
                  <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-500 uppercase">الاشتراك الخاص بالعميل</label>
                      <div className="flex items-center gap-2">
                        {editedSubscription && editedSubscription.is_active ? (
                          <>
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full">نشط ✅</span>
                            <button
                              type="button"
                              onClick={() => setIsEditingSub(!isEditingSub)}
                              className="p-1 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                              title="تعديل الاشتراك"
                            >
                              <Edit3 size={11} />
                              {isEditingSub ? 'تم' : 'تعديل'}
                            </button>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-200/60 text-slate-500 text-[10px] font-black rounded-full">لا يوجد اشتراك</span>
                        )}
                      </div>
                    </div>

                    {editedSubscription && editedSubscription.is_active ? (
                      !isEditingSub ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">اسم الاشتراك:</span>
                            <span className="font-black text-indigo-900">
                              {subscriptionPackages.find(p => p.id === editedSubscription.package_id)?.name || 'باقة مخصصة'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">الرصيد المتبقي:</span>
                            <span className="font-extrabold text-emerald-700">
                              {editedSubscription.items_remaining} قطعة / {editedSubscription.total_items} قطعة
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-500">تاريخ الانتهاء:</span>
                            <span className="font-bold text-slate-600">
                              {safeFormatDate(editedSubscription.expiry_date)}
                            </span>
                          </div>

                          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-black text-slate-700">تفعيل الدفع من الاشتراك للطلب:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const usesSub = showEditOrderModal.payment_method === 'Subscription';
                                setShowEditOrderModal(prev => {
                                  if (!prev) return null;
                                  return {
                                    ...prev,
                                    payment_method: usesSub ? 'Cash' : 'Subscription',
                                    is_paid: usesSub ? prev.is_paid : true
                                  };
                                });
                              }}
                              className={`px-3 py-1.5 text-xs font-black rounded-lg transition-all border ${
                                showEditOrderModal.payment_method === 'Subscription'
                                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {showEditOrderModal.payment_method === 'Subscription' ? 'مفعل ✅' : 'تفعيل'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 p-3 bg-white border border-slate-200 rounded-2xl animate-in fade-in-50 duration-200 font-black">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-1 text-right">خطة الباقة</label>
                            <select
                              value={editedSubscription.package_id}
                              onChange={e => {
                                const selectedPkg = subscriptionPackages.find(p => p.id === e.target.value);
                                if (selectedPkg && editedSubscription) {
                                  const expIso = safeAddDaysISO(selectedPkg.duration_days);
                                  setEditedSubscription({
                                    ...editedSubscription,
                                    package_id: selectedPkg.id,
                                    total_items: selectedPkg.total_items,
                                    items_remaining: selectedPkg.total_items,
                                    expiry_date: expIso
                                  });
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-black outline-none focus:border-indigo-500 text-right"
                            >
                              {subscriptionPackages.map(pkg => (
                                <option key={pkg.id} value={pkg.id}>{pkg.name} ({pkg.total_items} قطعة - {pkg.price} ر.س)</option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 mb-1 text-right">الرصيد المتبقي</label>
                              <input
                                type="number"
                                value={editedSubscription.items_remaining}
                                onChange={e => setEditedSubscription({ ...editedSubscription, items_remaining: parseInt(e.target.value) || 0 })}
                                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-black text-center font-mono outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 mb-1 text-right">الرصيد الكلي</label>
                              <input
                                type="number"
                                value={editedSubscription.total_items}
                                onChange={e => setEditedSubscription({ ...editedSubscription, total_items: parseInt(e.target.value) || 0 })}
                                className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-black text-center font-mono outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-400 mb-1 text-right font-sans">تاريخ الانتهاء</label>
                            <input
                              type="date"
                              value={safeDateToInputVal(editedSubscription.expiry_date)}
                              onChange={e => {
                                if (!editedSubscription) return;
                                const d = new Date(e.target.value);
                                if (!isNaN(d.getTime())) {
                                  setEditedSubscription({ ...editedSubscription, expiry_date: d.toISOString() });
                                }
                              }}
                              className="w-full bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-black text-center outline-none focus:border-indigo-500 font-mono"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!editedSubscription) return;
                                try {
                                  const { error: subErr } = await supabase
                                    .from('subscriptions')
                                    .update({
                                      package_id: editedSubscription.package_id,
                                      items_remaining: editedSubscription.items_remaining,
                                      total_items: editedSubscription.total_items,
                                      expiry_date: editedSubscription.expiry_date,
                                      is_active: editedSubscription.is_active
                                    })
                                    .eq('id', editedSubscription.id);
                                  if (subErr) throw subErr;

                                  setSubscriptions(prev => prev.map(s => s.id === editedSubscription.id ? editedSubscription : s));
                                  setIsEditingSub(false);
                                  alert("تم حفظ تعديلات الباقة بنجاح ✅");
                                } catch (err: any) {
                                  alert(`فشل حفظ تعديلات الباقة: ${err.message}`);
                                }
                              }}
                              className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black hover:bg-indigo-700 transition-all text-center"
                            >
                              حفظ التغييرات للباقة
                            </button>
                            {subDeleteConfirmId === editedSubscription.id ? (
                              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-150">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const { error: subErr } = await supabase
                                        .from('subscriptions')
                                        .update({ is_active: false })
                                        .eq('id', editedSubscription.id);
                                      if (subErr) throw subErr;

                                      setSubscriptions(prev => prev.map(s => s.id === editedSubscription.id ? { ...s, is_active: false } : s));
                                      setEditedSubscription(null);
                                      setIsEditingSub(false);
                                      setSubDeleteConfirmId(null);
                                      setShowEditOrderModal(prev => {
                                        if (!prev) return null;
                                        return {
                                          ...prev,
                                          payment_method: prev.payment_method === 'Subscription' ? 'Cash' : prev.payment_method
                                        };
                                      });
                                    } catch (err: any) {
                                      alert(`فشل حذف الاشتراك: ${err.message}`);
                                    }
                                  }}
                                  className="py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 shadow-sm"
                                >
                                  <Trash2 size={12} />
                                  تأكيد الحذف ⚠️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSubDeleteConfirmId(null)}
                                  className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black transition-all"
                                >
                                  تراجع
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSubDeleteConfirmId(editedSubscription.id)}
                                className="py-1.5 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1"
                              >
                                <Trash2 size={12} />
                                حذف الاشتراك
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="space-y-3">
                        <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                          العميل لا يمتلك أي باقة اشتراك سارية للاستخدام بالدفع. يمكنك تفعيل اشتراك فوري له الآن:
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAssignSubModal({
                              name: showEditOrderModal.customer_name || 'عميل مجهول',
                              phone: showEditOrderModal.customer_phone
                            });
                          }}
                          className="w-full py-2.5 px-4 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                        >
                          <UserPlus size={14} />
                          تفعيل اشتراك جديد للعميل
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Order Financial & Settings */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase mb-2">حالة الطلب</label>
                      <select 
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-black outline-none focus:border-indigo-500 transition-all text-right"
                        value={showEditOrderModal.status}
                        onChange={e => setShowEditOrderModal({...showEditOrderModal, status: e.target.value as OrderStatus})}
                      >
                        {Object.entries(statusArabic).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2">تعديل مالي (رس)</label>
                        <div className="relative">
                          <Banknote className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="number" 
                            step="0.5"
                            placeholder="تعديل مالي" 
                            className="w-full pr-12 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" 
                            value={editCustomAdjustment || ''} 
                            onChange={e => setEditCustomAdjustment(parseFloat(e.target.value) || 0)} 
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-black text-slate-400 uppercase mb-2">خصم %</label>
                        <div className="relative">
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">%</div>
                          <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            placeholder="خصم %" 
                            className="w-full pr-10 pl-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" 
                            value={editDiscountPercent || ''} 
                            onChange={e => {
                              const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                              setEditDiscountPercent(val);
                              setEditOrderItems(prev => prev.map(item => ({ ...item, discount_percent: val })));
                            }} 
                          />
                        </div>
                      </div>
                    </div>

                    {/* Checkboxes/Grid details */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        type="button"
                        onClick={() => {
                          const isFree = showEditOrderModal.payment_method === 'Free';
                          setShowEditOrderModal({
                            ...showEditOrderModal,
                            payment_method: isFree ? 'Cash' : 'Free',
                            is_paid: !isFree
                          });
                        }} 
                        className={`py-3.5 rounded-2xl border font-black transition-all flex items-center justify-center gap-2 text-xs ${showEditOrderModal.payment_method === 'Free' ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                      >
                        {showEditOrderModal.payment_method === 'Free' ? <Check size={16} /> : <Gift size={16} />}
                        {showEditOrderModal.payment_method === 'Free' ? 'طلب مجاني ✅' : 'طلب مجاني؟'}
                      </button>
                      
                      <button 
                        type="button"
                        onClick={() => setEditIsTaxEnabled(!editIsTaxEnabled)} 
                        className={`py-3.5 rounded-2xl border font-black transition-all flex items-center justify-center gap-2 text-xs ${editIsTaxEnabled ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                      >
                        {editIsTaxEnabled ? <Check size={16} /> : <AlertTriangle size={16} />}
                        {editIsTaxEnabled ? 'الضريبة مفعلة (15%)' : 'بدون ضريبة'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Side: Predefined Categories & Selected Items */}
                <div className="lg:col-span-7 flex flex-col space-y-6">
                  
                  {/* Category badgess to select and add items */}
                  <div>
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-wider border-b pb-2 mb-3">إضافة مواد للطلب (اضغط للإضافة)</h4>
                    <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
                      {categories.map((cat, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const existing = editOrderItems.find(i => i.name === cat.name && !i.is_urgent && !i.is_ironing_only && !i.is_no_ironing && (i.service_type || 'عادي') === 'عادي');
                            if (existing) {
                              setEditOrderItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
                            } else {
                              const id = Math.random().toString(36).substr(2, 9);
                              const prices = getItemPrices(cat);
                              setEditOrderItems(prev => [...prev, {
                                id,
                                name: cat.name,
                                quantity: 1,
                                price: prices.price_normal,
                                service_type: 'عادي',
                                ironing_type: 'غسيل وكوي',
                                is_ironing_only: false,
                                is_urgent: false,
                                is_no_ironing: false,
                                price_normal: prices.price_normal,
                                price_urgent: prices.price_urgent,
                                price_ironing: prices.price_ironing,
                                price_no_ironing: prices.price_no_ironing,
                                discount_percent: editDiscountPercent
                              }]);
                            }
                          }}
                          className="py-2.5 px-3 bg-white border border-slate-100/90 rounded-2xl flex items-center gap-2 text-xs font-black shadow-sm hover:border-indigo-500 hover:bg-slate-50 transition-all active:scale-95"
                        >
                          <span className="text-lg">{cat.icon || '👕'}</span>
                          <span>{cat.name}</span>
                          <span className="text-[10px] font-bold text-indigo-600 font-mono">{cat.price} ر.س</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* List of Current Items */}
                  <div className="flex-1 overflow-y-auto max-h-[35vh] space-y-3 pr-1 border-t pt-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase mb-2">مواد الفاتورة الحالية:</h4>
                    {editOrderItems.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs font-black">
                        لا توجد أصناف في هذا الطلب حالياً. الرجاء الإضافة من القائمة أعلاه.
                      </div>
                    ) : (
                      editOrderItems.map(item => (
                        <div key={item.id} className="flex flex-col gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200/60">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-indigo-950">{item.name}</span>
                              <span className="text-xs font-extrabold text-indigo-600">{(item.quantity * item.price).toFixed(2)} ر.س <span className="text-[10px] text-slate-400 font-normal">({item.price.toFixed(2)} للقطعة)</span></span>
                            </div>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => updateEditItemQuantity(item.id, -1)} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center text-red-500 hover:bg-slate-50 active:scale-90"><Trash2 size={14} /></button>
                              <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                              <button type="button" onClick={() => updateEditItemQuantity(item.id, 1)} className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center text-emerald-500 hover:bg-slate-50 active:scale-90"><Plus size={14} /></button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                            {/* Option Selector checkboxes in row */}
                            <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-100/90 rounded-xl">
                              <button
                                type="button"
                                onClick={() => {
                                  updateEditItemMode(item.id, 'عادي');
                                }}
                                className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                  item.is_normal
                                    ? 'bg-slate-500 text-white shadow-sm font-bold'
                                    : 'text-slate-500 hover:bg-white/50 bg-transparent'
                                }`}
                              >
                                عادي
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateEditItemMode(item.id, 'مستعجل');
                                }}
                                className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                  (item.is_urgent || item.service_type === 'مستعجل')
                                    ? 'bg-red-500 text-white shadow-sm font-bold'
                                    : 'text-slate-500 hover:bg-white/50 bg-transparent'
                                }`}
                              >
                                مستعجل 🔥
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  updateEditItemMode(item.id, 'كوي');
                                }}
                                className={`py-1.5 text-[10px] font-black rounded-lg transition-all ${
                                  item.is_ironing_only
                                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                                    : 'text-slate-500 hover:bg-white/50 bg-transparent'
                                }`}
                              >
                                كوي
                              </button>
                            </div>

                            {/* Custom prices inputs */}
                            <div className="grid grid-cols-3 gap-1.5 text-[8.5px] font-bold text-slate-400 mt-1">
                              <div className="flex flex-col gap-1 text-center font-bold">
                                <span className="text-slate-500 font-black">عادي</span>
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                                  <input 
                                    type="number" 
                                    step="0.5"
                                    className="w-full text-center font-black text-[9px] outline-none text-slate-700 bg-transparent"
                                    value={getItemPrices(item).price_normal}
                                    onChange={e => updateEditItemCustomPrice(item.id, 'normal', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 text-center font-bold">
                                <span className="text-red-500 font-black">مستعجل</span>
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                                  <input 
                                    type="number" 
                                    step="0.5"
                                    className="w-full text-center font-black text-[9px] outline-none text-slate-700 bg-transparent"
                                    value={getItemPrices(item).price_urgent}
                                    onChange={e => updateEditItemCustomPrice(item.id, 'urgent', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 text-center font-bold">
                                <span className="text-indigo-600">كوي</span>
                                <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                                  <input 
                                    type="number" 
                                    step="0.5"
                                    className="w-full text-center font-black text-[9px] outline-none text-slate-700 bg-transparent"
                                    value={getItemPrices(item).price_ironing}
                                    onChange={e => updateEditItemCustomPrice(item.id, 'ironing', parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Financial calculation summary & payment */}
                  <div className="bg-[#1E1B4B] text-white p-6 rounded-3xl shadow-xl space-y-4 shrink-0">
                    <div className="space-y-2 text-sm">
                      {editDiscountPercent > 0 && (
                        <div className="flex justify-between items-center text-slate-400 text-xs">
                          <span>المجموع المبدئي:</span>
                          <span>{(editOrderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) + editCustomAdjustment).toFixed(2)} ر.س</span>
                        </div>
                      )}
                      {editDiscountPercent > 0 && (
                        <div className="flex justify-between items-center text-red-400 text-xs font-black">
                          <span>خصم ({editDiscountPercent}%):</span>
                          <span>-{((editOrderItems.reduce((acc, i) => acc + (i.price * i.quantity), 0) + editCustomAdjustment) * (editDiscountPercent / 100)).toFixed(2)} ر.س</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center text-slate-300 font-medium">
                        <span>المجموع:</span>
                        <span>{editSubtotal.toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300 font-medium">
                        <span>الضريبة ({editIsTaxEnabled ? '15%' : '0%'}):</span>
                        <span>{editTax.toFixed(2)} ر.س</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-white/10 pt-3">
                        <span className="font-black text-lg">الإجمالي الحالي:</span>
                        <span className="font-black text-2xl text-indigo-300">{editTotal.toFixed(2)} ر.س</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button 
                        type="button" 
                        onClick={() => setShowEditOrderModal({...showEditOrderModal, is_paid: !showEditOrderModal.is_paid})} 
                        className={`py-3 rounded-xl border font-black text-xs transition-all ${showEditOrderModal.is_paid ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
                      >
                        {showEditOrderModal.is_paid ? 'تم السداد ✅' : 'لم يسدد'}
                      </button>

                      {showEditOrderModal.is_paid && (
                        <select 
                          className="bg-white/10 border border-white/10 rounded-xl py-3 px-3 text-xs font-black text-white outline-none focus:border-white/40 text-right"
                          value={showEditOrderModal.payment_method} 
                          onChange={e => setShowEditOrderModal({...showEditOrderModal, payment_method: e.target.value as any})}
                        >
                          <option value="Cash" className="text-black">نقدي</option>
                          <option value="Card" className="text-black">شبكة</option>
                          <option value="Transfer" className="text-black">تحويل</option>
                          {getCustomerSubscription(showEditOrderModal.customer_phone) && (
                            <option value="Subscription" className="text-black">من الاشتراك</option>
                          )}
                          <option value="Free" className="text-black">مجاني</option>
                        </select>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
            
            {/* Modal Actions */}
            <div className="p-8 border-t border-slate-100 flex gap-4 shrink-0 bg-white">
              <button 
                type="button"
                onClick={() => {
                  const finalOrderSaved: Order = {
                    ...showEditOrderModal,
                    items: editOrderItems,
                    custom_adjustment: editCustomAdjustment,
                    subtotal: editSubtotal,
                    tax: editTax,
                    total: editTotal
                  };
                  handleUpdateOrder(finalOrderSaved);
                }}
                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
              >
                <Check size={20} />
                حفظ التغييرات
              </button>
              <button 
                type="button"
                onClick={() => setShowEditOrderModal(null)}
                className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black text-lg hover:bg-slate-200 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
              >
                إلغاء التعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {userToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative animate-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h2 className="text-2xl font-black mb-2">تأكيد حذف المستخدم</h2>
              <p className="text-slate-500 font-bold mb-8">
                هل أنت متأكد من حذف المستخدم <span className="text-red-600 font-black">{userToDelete.full_name || userToDelete.email}</span> نهائياً من النظام وقاعدة البيانات؟
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  disabled={deletingUserId === userToDelete.id}
                  onClick={() => handleDeleteUser(userToDelete.id)}
                  className="py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  {deletingUserId === userToDelete.id ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      جاري الحذف...
                    </>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      حذف نهائي
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {orderToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl relative animate-in zoom-in duration-200">
            <div className="text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} />
              </div>
              <h2 className="text-2xl font-black mb-2">تأكيد الحذف</h2>
              <p className="text-slate-500 font-bold mb-8">
                هل أنت متأكد من حذف الطلب رقم <span className="text-red-600 font-black">{orderToDelete.order_number}</span> نهائياً من قاعدة البيانات؟
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setOrderToDelete(null)}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
                >
                  إلغاء
                </button>
                <button 
                  disabled={deletingOrderId === orderToDelete.id}
                  onClick={() => deleteOrder(orderToDelete.id, orderToDelete.order_number)}
                  className="py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                >
                  {deletingOrderId === orderToDelete.id ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      جاري الحذف...
                    </>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      حذف نهائي
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 no-print">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowPrintModal(null)} className="absolute top-8 left-8 p-3 bg-slate-100 rounded-2xl text-slate-500"><X size={20} /></button>
            <div id="print-area" className="text-center bg-white p-6 rounded-3xl">
              <div className="mb-8"><div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl font-black">M</div><h2 className="text-2xl font-black mb-1">مغسلة عود ونظافة</h2></div>
              <div className="border-y border-slate-100 py-6 mb-8 text-right space-y-3">
                <div className="flex justify-between items-center text-xs"><span>العميل:</span><span className="font-black">{showPrintModal.customer_name}</span></div>
                <div className="flex justify-between items-center text-xs"><span>رقم الهاتف:</span><span dir="ltr" className="font-bold">{showPrintModal.customer_phone}</span></div>
                <div className="flex justify-between items-center text-xs"><span>رقم الفاتورة:</span><span className="font-mono font-black">{showPrintModal.order_number}</span></div>
                <div className="flex justify-between items-center text-xs"><span>التاريخ:</span><span className="font-bold">{new Date(showPrintModal.created_at).toLocaleString('ar-SA')}</span></div>
              </div>
              <div className="space-y-4 mb-10 text-right">
                {(() => {
                  const groups = getGroupedItems(showPrintModal.items || []);
                  return groups.map((group) => {
                    const groupKey = `printmodal_${group.key}`;
                    const isExpanded = expandedGroups[groupKey];
                    const optText = (() => {
                      const opts: string[] = [];
                      if (group.item.service_type === 'مستعجل' || (group.item as any).is_urgent) opts.push('مستعجل 🔥');
                      if (group.item.is_ironing_only) opts.push('كوي');
                      if ((group.item as any).is_no_ironing || group.item.ironing_type === 'بدون كوي') opts.push('بدون كوي');
                      if (opts.length === 0) opts.push('عادي');
                      return opts.join(' + ');
                    })();

                    return (
                      <div key={group.key} className="border-b border-slate-100 last:border-0 pb-3">
                        <div 
                          onClick={() => toggleExpandGroup('printmodal', group.key)}
                          className="flex justify-between items-center text-sm font-black cursor-pointer hover:bg-slate-50 p-1.5 rounded-xl transition-all select-none"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{group.item.name}</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-black font-mono">x{group.totalQty}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({optText})</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span>{(group.totalPrice).toFixed(2)} ر.س</span>
                            <span className="text-[11px] text-indigo-500 font-bold transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                              ▼
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-2 mr-3 pr-3 border-r-2 border-indigo-100 space-y-1 text-right">
                            {group.originalItems.map((orig, subIdx) => (
                              <div key={subIdx} className="flex justify-between items-center text-xs text-slate-500 font-bold bg-slate-100/40 p-1.5 px-3 rounded-xl">
                                <span>قطعة {subIdx + 1} - {orig.name}</span>
                                <span>{orig.price.toFixed(2)} ر.س</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
              <div className="bg-slate-50 p-8 rounded-[2.5rem] border mb-6"><div className="flex justify-between text-2xl font-black pt-4"><span>الإجمالي</span><span className="text-indigo-600">{showPrintModal.total.toFixed(2)} ر.س</span></div></div>
              <div className="text-[10px] text-slate-400 font-bold mb-8 leading-relaxed text-center">
                تنويه هام: المغسلة غير مسؤولة عن فقدان أي أغراض شخصية تُترك داخل الملابس عند استلامها، كما لا تتحمل مسؤولية حفظ الملابس أو الأغراض بعد مضي (15) يومًا من تاريخ الاستلام.
              </div>
              <BarcodeGenerator value={showPrintModal.order_number} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <button onClick={() => window.print()} className="bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3"><Printer size={22}/> طباعة</button>
              <button onClick={() => handleDownloadPDF(showPrintModal)} className="bg-orange-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-orange-600 transition-all flex items-center justify-center gap-3"><Download size={22}/> تحميل PDF</button>
              {/* هنا نرسل RECEIVED لأننا في الفاتورة */}
              <button onClick={() => sendWhatsAppReminder(showPrintModal, 'RECEIVED')} className="bg-emerald-500 text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 sm:col-span-2"><Send size={22}/> إرسال واتساب يدوي</button>
            </div>
          </div>
        </div>
      )}

      {editingUserProfile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4 text-right">
          <div className="bg-white rounded-[3rem] w-full max-w-lg p-8 shadow-2xl relative animate-in zoom-in duration-200 overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setEditingUserProfile(null)} 
              className="absolute top-6 left-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-all"
            >
              <X size={18} />
            </button>
            
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-xl font-black flex items-center gap-2 text-indigo-950">
                  <Edit3 className="text-indigo-600" size={22} /> تعديل صلاحيات المستخدم
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1">تحديث الاسم، نوع الحساب، المغسلة المرتبطة، وصفحات الوصول</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">الاسم الكامل</label>
                  <input
                    type="text"
                    required
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all"
                    value={editingUserForm.full_name}
                    onChange={e => setEditingUserForm({...editingUserForm, full_name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">البريد الإلكتروني (غير قابل للتعديل)</label>
                  <input
                    type="text"
                    disabled
                    className="w-full px-5 py-3 bg-slate-100 border border-slate-100 rounded-2xl outline-none font-bold text-sm text-left text-slate-400 cursor-not-allowed"
                    dir="ltr"
                    value={editingUserProfile.email || ''}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">نوع الحساب والصلاحية العامة</label>
                  <select
                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-xs transition-all"
                    value={editingUserForm.role}
                    onChange={e => {
                      const nextRole = e.target.value as UserRole;
                      setEditingUserForm({
                        ...editingUserForm,
                        role: nextRole,
                        permissions: ROLE_PERMISSIONS[nextRole] || []
                      });
                    }}
                  >
                    <option value="staff">موظف (Staff)</option>
                    <option value="manager">مشرف مغسلة (Manager)</option>
                    <option value="admin">مدير نظام عام (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">ربط بالمغسلة</label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl outline-none font-bold text-xs transition-all"
                      value={editingUserForm.laundry_id}
                      onChange={e => {
                        const selectedLaundry = laundries.find(l => l.id === e.target.value);
                        setEditingUserForm({
                          ...editingUserForm,
                          laundry_id: e.target.value,
                          laundry_name: selectedLaundry ? selectedLaundry.name : (userProfile?.laundry_name || '')
                        });
                      }}
                    >
                      <option value={userProfile?.laundry_id}>{userProfile?.laundry_name} (المغسلة الحالية)</option>
                      {laundries.filter(l => l.id !== userProfile?.laundry_id).map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        const name = prompt('يرجى إدخال اسم المغسلة الجديدة:');
                        if (name && name.trim()) {
                          const newId = ensureUUID(Math.random().toString(36).substring(2, 15));
                          const added = await addLaundryToPlatform(newId, name.trim());
                          if (added) {
                            setEditingUserForm(prev => ({
                              ...prev,
                              laundry_id: newId,
                              laundry_name: name.trim()
                            }));
                            alert('تمت إضافة المغسلة الجديدة وتحديدها بنجاح! 🎉');
                          } else {
                            alert('المغسلة موجودة بالفعل أو حدث خطأ أثناء الإضافة.');
                          }
                        }
                      }}
                      className="px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-2xl border border-indigo-200 text-xs font-black transition-all"
                    >
                      + مغسلة جديدة
                    </button>
                  </div>
                </div>

                {/* Specific Pages Access / Permissions */}
                <div className="space-y-2 pt-4 border-t border-slate-100">
                  <label className="block text-xs font-black text-slate-600 flex items-center gap-1.5">
                    <Settings2 size={14} className="text-indigo-600" /> تعديل الصفحات المسموحة (Page Access)
                  </label>
                  <p className="text-[10px] text-slate-400 font-bold mb-3">حدد بالضبط الصفحات المسموح للمستخدم برؤيتها والدخول إليها:</p>
                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                    {navItems.map(item => {
                      const IconComponent = item.icon;
                      const isChecked = editingUserForm.permissions.includes(item.id);
                      return (
                        <label key={item.id} className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border transition-all ${isChecked ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950 font-black' : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-500'}`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const newPerms = isChecked
                                ? editingUserForm.permissions.filter(p => p !== item.id)
                                : [...editingUserForm.permissions, item.id];
                              setEditingUserForm({...editingUserForm, permissions: newPerms});
                            }}
                            className="accent-indigo-600 rounded"
                          />
                          <span className="text-[11px] font-bold flex items-center gap-1">
                            <IconComponent size={12} className={isChecked ? "text-indigo-600" : "text-slate-400"} />
                            {item.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUserProfile(null)}
                  className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all text-center"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={saveLoading}
                  onClick={handleUpdateUserProfile}
                  className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saveLoading ? <Loader2 className="animate-spin" size={16} /> : 'حفظ التعديلات'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSaaSPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[250] p-4 text-right">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl relative animate-in zoom-in duration-200">
            <button 
              onClick={() => setShowSaaSPaymentModal(false)} 
              className="absolute top-6 left-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 transition-all"
            >
              <X size={18} />
            </button>
            
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <Sparkles size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">تجديد اشتراك المغسلة</h3>
                <p className="text-slate-400 font-bold text-xs mt-1">أنت مشترك حالياً في الباقة السحابية الشاملة</p>
              </div>

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-right space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-indigo-950">
                  <span>خطة الاشتراك:</span>
                  <span className="font-black text-indigo-600">الباقة السحابية الشاملة 🏆</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-indigo-950">
                  <span>قيمة الاشتراك:</span>
                  <span className="font-black text-indigo-600">199 ريال / شهرياً</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold text-indigo-950">
                  <span>حالة التجديد:</span>
                  <span className="font-black text-emerald-600">نشط (تجديد تلقائي)</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 font-bold leading-relaxed px-2">
                شكراً لثقتكم واختياركم منصة مغسلة نظافة وعود السحابية! لإتمام تجديد الاشتراك السنوي أو الشهري يرجى التواصل مباشرة مع الدعم الفني للمنصة.
              </div>

              <div className="grid grid-cols-1 gap-3 pt-4">
                <a
                  href="https://wa.me/966500000000"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  تواصل عبر الواتساب لتأكيد الدفع 💬
                </a>
                <button
                  type="button"
                  onClick={() => setShowSaaSPaymentModal(false)}
                  className="py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-sm transition-all"
                >
                  إغلاق النافذة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
