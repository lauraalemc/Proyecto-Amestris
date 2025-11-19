export type Material = {
  id: number;
  name: string;
  quantity: number;
  unit: string;        
  rarity?: string;     
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
  materialName?: string; 
  missionTitle?: string;
};

export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  q?: string;
}
