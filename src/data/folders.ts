export type FolderIconKey =
  | "Groceries"
  | "Food"
  | "Healthcare"
  | "Travel"
  | "Entertainment"
  | "Beauty"
  | "Apparels"
  | "Stationery"
  | "Religion"
  | "Automobile"
  | "Hardware"
  | "Housekeeping";

export interface Folder {
  name: FolderIconKey;
  count: number;
  amount: number;
}

export interface Invoice {
  store: string;
  date: string;
  amount: number;
  unseen?: boolean;
}

export interface Offer {
  pct: string;
  merchant: string;
  desc: string;
  exp: string;
}

export const FOLDERS: Folder[] = [
  { name: "Groceries", count: 24, amount: 6180 },
  { name: "Food", count: 31, amount: 5760 },
  { name: "Healthcare", count: 14, amount: 3120 },
  { name: "Travel", count: 4, amount: 22400 },
  { name: "Entertainment", count: 11, amount: 2890 },
  { name: "Beauty", count: 12, amount: 7240 },
  { name: "Apparels", count: 10, amount: 5480 },
  { name: "Stationery", count: 6, amount: 1240 },
  { name: "Religion", count: 3, amount: 2150 },
  { name: "Automobile", count: 6, amount: 14300 },
  { name: "Hardware", count: 7, amount: 9050 },
  { name: "Housekeeping", count: 9, amount: 4260 },
];

export const INVOICES_BY_FOLDER: Record<string, Invoice[]> = {
  Groceries: [
    { store: "BigBasket", date: "Sep 3 · 7:10 PM", amount: 1240, unseen: true },
    { store: "More Supermarket", date: "Sep 1 · 6:05 PM", amount: 860, unseen: true },
    { store: "Local Kirana Store", date: "Aug 29 · 9:20 AM", amount: 410 },
    { store: "DMart", date: "Aug 24 · 5:40 PM", amount: 1980 },
  ],
  Food: [
    { store: "Barbeque Nation", date: "Sep 3 · 8:42 PM", amount: 1850, unseen: true },
    { store: "Domino's Pizza", date: "Sep 2 · 1:15 PM", amount: 620, unseen: true },
    { store: "Cafe Coffee Day", date: "Aug 30 · 5:20 PM", amount: 340 },
    { store: "Swaad Family Restaurant", date: "Aug 28 · 9:05 PM", amount: 980 },
    { store: "McDonald's", date: "Aug 25 · 2:40 PM", amount: 410 },
    { store: "Local Tiffin Service", date: "Aug 22 · 1:00 PM", amount: 150 },
    { store: "Starbucks", date: "Aug 19 · 11:30 AM", amount: 560 },
  ],
  Healthcare: [
    { store: "Apollo Pharmacy", date: "Sep 4 · 8:15 AM", amount: 680, unseen: true },
    { store: "1mg", date: "Sep 1 · 10:40 AM", amount: 450 },
    { store: "Fortis Diagnostics", date: "Aug 26 · 2:20 PM", amount: 1200 },
    { store: "MedPlus", date: "Aug 18 · 6:30 PM", amount: 340 },
  ],
  Travel: [
    { store: "MakeMyTrip", date: "Sep 1 · 9:00 AM", amount: 18200, unseen: true },
    { store: "Ola Cabs", date: "Aug 27 · 7:45 PM", amount: 680 },
    { store: "IRCTC", date: "Aug 20 · 11:00 AM", amount: 2340 },
    { store: "Uber", date: "Aug 14 · 8:10 AM", amount: 1180 },
  ],
  Entertainment: [
    { store: "PVR Cinemas", date: "Sep 3 · 9:30 PM", amount: 740, unseen: true },
    { store: "Netflix", date: "Sep 1 · 12:00 AM", amount: 649 },
    { store: "BookMyShow", date: "Aug 24 · 6:15 PM", amount: 560 },
    { store: "Spotify", date: "Aug 15 · 12:00 AM", amount: 119 },
  ],
  Beauty: [
    { store: "Nykaa", date: "Sep 3 · 6:20 PM", amount: 1850, unseen: true },
    { store: "Lakme Salon", date: "Sep 1 · 4:00 PM", amount: 2200, unseen: true },
    { store: "Sephora", date: "Aug 26 · 1:30 PM", amount: 1340 },
    { store: "Local Beauty Parlour", date: "Aug 18 · 11:00 AM", amount: 680 },
  ],
  Apparels: [
    { store: "Zara", date: "Sep 2 · 5:45 PM", amount: 2600, unseen: true },
    { store: "Myntra", date: "Aug 29 · 2:15 PM", amount: 1480 },
    { store: "Local Tailor", date: "Aug 22 · 10:00 AM", amount: 650 },
    { store: "H&M", date: "Aug 14 · 3:30 PM", amount: 750 },
  ],
  Stationery: [
    { store: "Office Depot", date: "Sep 1 · 1:00 PM", amount: 480, unseen: true },
    { store: "Local Stationery Shop", date: "Aug 25 · 4:20 PM", amount: 210 },
    { store: "Amazon", date: "Aug 18 · 9:40 AM", amount: 340 },
    { store: "Classmate Store", date: "Aug 9 · 5:00 PM", amount: 210 },
  ],
  Religion: [
    { store: "Temple Donation", date: "Sep 1 · 8:00 AM", amount: 1100, unseen: true },
    { store: "Pooja Store", date: "Aug 20 · 5:30 PM", amount: 650 },
    { store: "Prasad Offering", date: "Aug 10 · 7:00 AM", amount: 400 },
  ],
  Automobile: [
    { store: "Indian Oil Petrol Pump", date: "Sep 3 · 8:00 AM", amount: 2500, unseen: true },
    { store: "Maruti Service Center", date: "Aug 25 · 10:30 AM", amount: 6800 },
    { store: "Local Tyre Shop", date: "Aug 19 · 3:20 PM", amount: 3200 },
    { store: "FASTag Recharge", date: "Aug 10 · 9:15 AM", amount: 1800 },
  ],
  Hardware: [
    { store: "Havells Store", date: "Sep 2 · 3:15 PM", amount: 4200, unseen: true },
    { store: "Local Hardware Shop", date: "Aug 28 · 5:00 PM", amount: 1850 },
    { store: "Asian Paints", date: "Aug 22 · 12:30 PM", amount: 2100 },
    { store: "Bosch Service Center", date: "Aug 15 · 4:45 PM", amount: 900 },
  ],
  Housekeeping: [
    { store: "Urban Company", date: "Sep 2 · 11:00 AM", amount: 1499, unseen: true },
    { store: "Local Maid Service", date: "Aug 28 · 8:30 AM", amount: 1200 },
    { store: "Laundry Express", date: "Aug 22 · 6:00 PM", amount: 640 },
    { store: "Pest Control Pro", date: "Aug 12 · 10:15 AM", amount: 920 },
  ],
};

export const OFFERS_BY_FOLDER: Record<string, Offer[]> = {
  Groceries: [
    { pct: "10% OFF", merchant: "BigBasket", desc: "On orders above ₹999", exp: "Ends Sep 18" },
    { pct: "₹150 OFF", merchant: "DMart", desc: "Min order ₹1,200", exp: "Ends Sep 22" },
    { pct: "5% CASHBACK", merchant: "More Supermarket", desc: "Via SnapBill wallet", exp: "Ends Sep 30" },
  ],
  Food: [
    { pct: "20% OFF", merchant: "Barbeque Nation", desc: "On dine-in bills above ₹1,000", exp: "Ends Sep 15" },
    { pct: "BUY 1 GET 1", merchant: "Domino's Pizza", desc: "Medium pizzas · Tue & Wed only", exp: "Ends Sep 10" },
    { pct: "₹100 OFF", merchant: "Swaad Family Restaurant", desc: "Min order ₹500 · dine-in only", exp: "Ends Sep 20" },
    { pct: "15% OFF", merchant: "Cafe Coffee Day", desc: "Beverages · before 11 AM", exp: "Ends Sep 12" },
    { pct: "10% OFF", merchant: "Starbucks", desc: "SnapBill app users only", exp: "Ends Sep 25" },
  ],
  Healthcare: [
    { pct: "18% OFF", merchant: "1mg", desc: "Medicine orders above ₹500", exp: "Ends Sep 16" },
    { pct: "FREE DELIVERY", merchant: "Apollo Pharmacy", desc: "On all orders", exp: "Ends Sep 30" },
    { pct: "10% OFF", merchant: "Fortis Diagnostics", desc: "Full body checkup packages", exp: "Ends Sep 25" },
  ],
  Travel: [
    { pct: "15% OFF", merchant: "MakeMyTrip", desc: "Domestic flight bookings", exp: "Ends Sep 20" },
    { pct: "FLAT ₹100 OFF", merchant: "Ola Cabs", desc: "First 3 rides this month", exp: "Ends Sep 30" },
    { pct: "5% CASHBACK", merchant: "IRCTC", desc: "AC class tickets", exp: "Ends Sep 25" },
  ],
  Entertainment: [
    { pct: "20% OFF", merchant: "PVR Cinemas", desc: "Weekday shows before 6 PM", exp: "Ends Sep 14" },
    { pct: "BUY 1 GET 1", merchant: "BookMyShow", desc: "Concert tickets", exp: "Ends Sep 22" },
    { pct: "3 MONTHS FREE", merchant: "Spotify", desc: "New premium subscribers", exp: "Ends Sep 30" },
  ],
  Beauty: [
    { pct: "20% OFF", merchant: "Nykaa", desc: "Skincare above ₹999", exp: "Ends Sep 16" },
    { pct: "15% OFF", merchant: "Lakme Salon", desc: "Hair spa & styling", exp: "Ends Sep 24" },
    { pct: "BUY 2 GET 1", merchant: "Sephora", desc: "Select cosmetics", exp: "Ends Sep 12" },
  ],
  Apparels: [
    { pct: "30% OFF", merchant: "Zara", desc: "End of season sale", exp: "Ends Sep 20" },
    { pct: "FLAT ₹200 OFF", merchant: "Myntra", desc: "Orders above ₹1,500", exp: "Ends Sep 15" },
    { pct: "10% OFF", merchant: "H&M", desc: "First purchase via SnapBill", exp: "Ends Sep 30" },
  ],
  Stationery: [
    { pct: "10% OFF", merchant: "Office Depot", desc: "Bulk orders above ₹500", exp: "Ends Sep 20" },
    { pct: "₹50 OFF", merchant: "Local Stationery Shop", desc: "Orders above ₹300", exp: "Ends Sep 28" },
  ],
  Religion: [{ pct: "FREE PRASAD", merchant: "Temple Donation", desc: "On donations above ₹500", exp: "Ends Sep 30" }],
  Automobile: [
    { pct: "5% CASHBACK", merchant: "Indian Oil", desc: "Fuel payments via SnapBill", exp: "Ends Sep 30" },
    { pct: "10% OFF", merchant: "Maruti Service Center", desc: "Annual maintenance package", exp: "Ends Sep 15" },
    { pct: "₹300 OFF", merchant: "Local Tyre Shop", desc: "Set of 4 tyres", exp: "Ends Sep 20" },
  ],
  Hardware: [
    { pct: "10% OFF", merchant: "Havells Store", desc: "Electricals above ₹2,000", exp: "Ends Sep 18" },
    { pct: "₹200 OFF", merchant: "Asian Paints", desc: "Paint orders above ₹1,500", exp: "Ends Sep 22" },
    { pct: "FREE INSTALLATION", merchant: "Bosch Service Center", desc: "On appliance purchases", exp: "Ends Sep 28" },
  ],
  Housekeeping: [
    { pct: "₹200 OFF", merchant: "Urban Company", desc: "Deep cleaning above ₹1,200", exp: "Ends Sep 20" },
    { pct: "15% OFF", merchant: "Laundry Express", desc: "Monthly laundry packs", exp: "Ends Sep 26" },
    { pct: "FREE INSPECTION", merchant: "Pest Control Pro", desc: "Before an annual contract", exp: "Ends Sep 30" },
  ],
};

/** Indian digit grouping, e.g. 110390 -> "1,10,390". */
export function formatINR(amount: number): string {
  const s = String(Math.abs(Math.round(amount)));
  const last3 = s.length > 3 ? s.slice(-3) : s;
  let other = s.length > 3 ? s.slice(0, -3) : "";
  if (other) other = other.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return "₹" + (other ? other + "," : "") + last3;
}

export function maskDigits(value: string): string {
  return value.replace(/\d/g, "•");
}

export interface FlatInvoice extends Invoice {
  folder: FolderIconKey;
}

export const ALL_INVOICES: FlatInvoice[] = FOLDERS.flatMap((f) =>
  (INVOICES_BY_FOLDER[f.name] || []).map((inv) => ({ ...inv, folder: f.name }))
);
