export type UserRole = 'customer' | 'provider' | 'admin';

export interface Address {
  id: string;
  tag: string;
  text: string;
  lat?: number;
  lng?: number;
  instructions?: string;
}

export interface Employee {
  id: string;
  realName: string;
  pseudoName: string;
  role?: string;
  active: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  phoneNumber?: string;
  phoneVerified?: boolean;
  role: UserRole;
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  rating?: number;
  totalJobs?: number;
  fcmToken?: string;
  serviceArea?: string;
  skills?: string[];
  addresses?: Address[];
  employees?: Employee[];
  createdAt: string;
  updatedAt: string;
}

export type RequestStatus = 'open' | 'booked' | 'completed' | 'cancelled';

export interface ServiceRequest {
  requestId: string;
  customerId: string;
  customerName: string;
  title: string;
  description: string;
  category: string;
  urgent: boolean;
  location: string;
  lat?: number;
  lng?: number;
  addressTag?: string;
  scheduledDate: string;
  isRecurring: boolean;
  recurrenceInterval: 'One-time' | 'Weekly' | 'Bi-weekly' | 'Monthly';
  requiredCleaners?: 'Individual' | 'Group' | 'Any';
  status: RequestStatus;
  createdAt: string;
  quoteCount: number;
  providerId?: string; // Added after booking
  providerName?: string; // Added after booking
}

export type QuoteStatus = 'pending' | 'accepted' | 'rejected';

export interface Quote {
  quoteId: string;
  requestId: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  amount: number;
  priceType: 'Fixed' | 'Hourly';
  isNegotiable: boolean;
  transportCost: number;
  materialCost: number;
  materialIncluded: boolean;
  message: string;
  assignedEmployees?: string[]; // Pseudo names or "Group"
  status: QuoteStatus;
  createdAt: string;
}

export interface Message {
  messageId: string;
  requestId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export type NotificationType = 'new_quote' | 'booking_accepted' | 'new_message' | 'status_update';

export interface Notification {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedId?: string; // Request ID or Quote ID
  read: boolean;
  createdAt: string;
}

export interface Review {
  reviewId: string;
  requestId: string;
  providerId: string;
  customerId: string;
  customerName: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
}
