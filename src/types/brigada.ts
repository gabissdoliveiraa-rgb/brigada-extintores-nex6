/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'Administrador' | 'Funcionário';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  phone: string;
  avatarUrl?: string;
  responsibleSector?: string;
  birthDate?: string;
  isLeader?: boolean;
  trainingStatus?: 'Em dia' | 'Vencido';
  password?: string;
  createdAt?: string;
}

export type RegisteredUser = UserProfile;

export interface FullDatabaseBackup {
  version: string;
  exportedAt: string;
  users: RegisteredUser[];
  extinguishers: Extinguisher[];
  inspections: Inspection[];
  brigadeMembers: BrigadeMember[];
  notices: Notice[];
  activityLogs?: ActivityLogEntry[];
}

export type ExtinguisherType = 'Pó Químico ABC' | 'CO2' | 'Água' | 'Espuma Mecânica';
export type ExtinguisherStatus = 'Em dia' | 'Atenção' | 'Vencido';

export interface Extinguisher {
  id: string;
  code: string;
  type: ExtinguisherType;
  location: string;
  floor: 'Térreo' | '1º andar' | '2º andar' | '3º andar' | '4º andar' | '5º andar' | '6º andar';
  capacity: string;
  status: ExtinguisherStatus;
  purchaseDate?: string;
  expirationDate?: string;
  nextInspectionDate?: string;
  notes?: string;
  qrCode?: string;
  x?: number; // Position on floor plan (percentage 0-100)
  y?: number;
}

export interface Inspection {
  id: string;
  code: string;
  extinguisherCode: string;
  extinguisherType: ExtinguisherType;
  date: string;
  responsible: string;
  status: ExtinguisherStatus;
  floor: 'Térreo' | '1º andar' | '2º andar' | '3º andar' | '4º andar' | '5º andar' | '6º andar';
  location: string;
  capacity: string;
  validityDate: string;
  nextInspectionDate: string;
  notes?: string;
}

export interface BrigadeMember {
  id: string;
  name: string;
  role: string; // e.g. "Líder da Brigada" | "Brigadista"
  isLeader: boolean;
  jobTitle: string; // e.g. "Técnico de Segurança", "Operador", "Analista"
  functionDescription: string;
  phone: string;
  email: string;
  responsibleFloor: 'Térreo' | '1º andar' | '2º andar' | '3º andar' | '4º andar' | '5º andar' | '6º andar' | 'Geral';
  trainingStatus: 'Em dia' | 'Vencido';
  trainingExpirationDate?: string;
  avatarUrl?: string;
}

export interface Notice {
  id: string;
  type: 'Inspeção vencida' | 'Recarga vencida' | 'Treinamento a vencer' | 'Aviso geral';
  description: string;
  date: string;
  status: 'Vencido' | 'A vencer' | 'Pendente';
  extinguisherCode?: string;
}

export interface ReportData {
  period: 'Diário' | 'Semanal' | 'Mensal';
  date: string;
  regularCount: number;
  expiringCount: number;
  criticalCount: number;
  totalCount: number;
  complianceRate: number;
}

export type ActivityCategory =
  | 'Extintores'
  | 'Inspeções'
  | 'Brigada'
  | 'Relatórios'
  | 'Usuários'
  | 'Sistema';

export type ActivityActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'inspect'
  | 'report'
  | 'login'
  | 'system';

export interface ActivityLogEntry {
  id: string;
  userName: string;
  userRole: UserRole;
  userEmail?: string;
  category: ActivityCategory;
  actionType: ActivityActionType;
  description: string;
  timestamp: string; // ISO string
  formattedDateTime: string; // e.g. "às 13:00 do dia 12/03/2026"
  targetCode?: string;
  targetFloor?: string;
  details?: string;
}
