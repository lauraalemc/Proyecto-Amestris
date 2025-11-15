export type Material = {
  id: number;
  name: string;
  quantity: number;
  unit: string;        // "kg", "L", "units", etc.
  rarity?: string;     // opcional: "common", "rare", "legendary"
  notes?: string;
};

export type Transmutation = {
  id: number;
  title: string;
  materialId: number;
  missionId?: number;
  quantityUsed: number;
  result?: string;
  createdAt?: string;
  materialName?: string; // si el backend lo agrega por conveniencia
  missionTitle?: string;
};

export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  q?: string;
}
