import LZString from 'lz-string';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  photo?: string;
  is_veg?: boolean | null; // true = veg, false = non-veg, null = not specified
}

export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}

export interface MenuData {
  restaurantName: string;
  tagline?: string;
  logo?: string;
  categories: MenuCategory[];
  currency: string;
}

// Max URL length for safe QR code generation (around 2000 chars for reliable scanning)
const MAX_URL_LENGTH = 2000;

export function encodeMenuData(data: MenuData): string {
  try {
    const json = JSON.stringify(data);
    // Use LZ-String compression for better compression ratio
    const compressed = LZString.compressToEncodedURIComponent(json);
    return compressed;
  } catch (error) {
    console.error('Error encoding menu data:', error);
    return '';
  }
}

export function decodeMenuData(encoded: string): MenuData | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    return JSON.parse(json);
  } catch (error) {
    console.error('Error decoding menu data:', error);
    return null;
  }
}

export function generateMenuUrl(data: MenuData): string {
  const encoded = encodeMenuData(data);
  const baseUrl = window.location.origin;
  return `${baseUrl}/m/${encoded}`;
}

// Check if the menu URL is too long for QR code
export function isMenuTooLarge(data: MenuData): boolean {
  const url = generateMenuUrl(data);
  return url.length > MAX_URL_LENGTH;
}

// Get URL length for display
export function getMenuUrlLength(data: MenuData): number {
  return generateMenuUrl(data).length;
}

// Create a lightweight version of menu data without images for QR
export function createLightweightMenuData(data: MenuData): MenuData {
  return {
    ...data,
    logo: undefined,
    categories: data.categories.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({
        ...item,
        photo: undefined,
      })),
    })),
  };
}

export function compressImage(file: File, maxWidth: number = 200, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
