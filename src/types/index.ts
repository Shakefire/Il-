export interface InfrastructureInfo {
  power: string;
  powerType: "Solar + Inverter" | "Dual Silent Generator" | "24/7 Dedicated Grid + Inverter";
  internet: string;
  security: string;
  water: string;
  parking: string;
}

export interface Amenity {
  name: string;
  category: "comfort" | "connectivity" | "kitchen" | "safety" | "wellness";
  highlight?: boolean;
}

export interface HostInfo {
  name: string;
  role: string;
  joinedYear: number;
  avatar: string;
  responseRate: string;
  responseTime: string;
  bio: string;
}

export interface Review {
  id: string;
  author: string;
  location: string;
  date: string;
  rating: number;
  comment: string;
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  city: "Abuja" | "Lagos";
  neighborhood: string;
  state: "FCT" | "Lagos State";
  pricePerNight: number;
  currency: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  images: string[];
  coverImage: string;
  propertyType: "Serviced Apartment" | "Private Residence" | "Penthouse" | "Garden Villa";
  infrastructure: InfrastructureInfo;
  amenities: Amenity[];
  host: HostInfo;
  coordinates: {
    lat: number;
    lng: number;
  };
  mapCoordinatesPercent?: {
    x: number; // percentage from left for custom minimalist interactive map
    y: number; // percentage from top
  };
  reviews: Review[];
  featured?: boolean;
}

export interface SearchFilters {
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number | "any";
  powerType?: string;
  propertyType?: string;
}
