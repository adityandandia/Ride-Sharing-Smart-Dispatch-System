import { z } from 'zod';

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);
const point = z.object({ lat, lng });

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(150),
    phone: z.string().trim().regex(/^[0-9+\-\s]{7,20}$/).optional(),
    password: z.string().min(8).max(72),
    role: z.enum(['Rider', 'Driver']), // Admin accounts are never self-registered
    licenseNo: z.string().trim().min(5).max(30).optional(),
    vehicle: z
      .object({
        plateNo: z.string().trim().min(4).max(20),
        model: z.string().trim().min(2).max(60),
        type: z.enum(['Auto', 'Mini', 'Sedan', 'SUV']),
        seats: z.number().int().min(1).max(8).default(4),
      })
      .optional(),
  })
  .refine((v) => v.role !== 'Driver' || (v.licenseNo && v.vehicle), {
    message: 'Drivers must provide a licence number and vehicle details',
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

export const rideRequestSchema = z.object({
  pickup: point,
  dropoff: point,
  pickupAddress: z.string().trim().max(200).optional(),
  dropoffAddress: z.string().trim().max(200).optional(),
  paymentMethod: z.enum(['Cash', 'Card', 'UPI']).default('UPI'),
});

export const locationSchema = point;
export const driverStatusSchema = z.object({ status: z.enum(['Available', 'Offline']) });
export const tripActionSchema = z.object({ action: z.enum(['start', 'complete', 'cancel']) });
export const reviewSchema = z.object({
  tripId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});
export const complaintSchema = z.object({
  tripId: z.number().int().positive(),
  description: z.string().trim().min(10).max(2000),
});
export const pricingSchema = z.object({
  baseFare: z.number().min(0).max(10000),
  perKm: z.number().min(0).max(1000),
  perMin: z.number().min(0).max(1000),
  minFare: z.number().min(0).max(10000),
  surgeOverride: z.number().min(1).max(5).nullable(),
});
export const disputeSearchSchema = z.object({ query: z.string().trim().min(3).max(500) });
