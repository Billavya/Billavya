export interface Contact {
  id: string;
  name: string;
  phone: string;
}

/**
 * A sample contact list — this preview has no permission to read the phone's
 * real address book (that needs a native contacts module, which would mean a
 * new app build). Split and Transfer pick from this list instead.
 */
export const CONTACTS: Contact[] = [
  { id: "c1", name: "Priya Sharma", phone: "+91 98450 11223" },
  { id: "c2", name: "Rohan Mehta", phone: "+91 99010 22334" },
  { id: "c3", name: "Ananya Iyer", phone: "+91 97400 33445" },
  { id: "c4", name: "Karan Malhotra", phone: "+91 98220 44556" },
  { id: "c5", name: "Sneha Reddy", phone: "+91 90080 55667" },
  { id: "c6", name: "Vikram Nair", phone: "+91 98860 66778" },
  { id: "c7", name: "Divya Kapoor", phone: "+91 97170 77889" },
  { id: "c8", name: "Arjun Rao", phone: "+91 99450 88990" },
  { id: "c9", name: "Neha Gupta", phone: "+91 98330 99001" },
  { id: "c10", name: "Aditya Menon", phone: "+91 97390 10112" },
  { id: "c11", name: "Ritu Bhatia", phone: "+91 98200 21223" },
  { id: "c12", name: "Siddharth Rao", phone: "+91 99160 32334" },
  { id: "c13", name: "Kavya Pillai", phone: "+91 90350 43445" },
  { id: "c14", name: "Manish Chawla", phone: "+91 98450 54556" },
  { id: "c15", name: "Tanvi Joshi", phone: "+91 97690 65667" },
];
