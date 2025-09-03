export type Product = {
  id: string;
  title: string;
  price: number;
  category: string;
  material: string;
  stock: number;
  images: string[];
  description: string;
};

export type CartLine = {
  productId: string;
  quantity: number;
};