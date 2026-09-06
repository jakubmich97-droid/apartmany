export type Apartment = {
  id: string
  name: string
  color: string
}

export type Booking = {
  id: string
  apartment_id: string
  guest_name: string
  guest_count: number
  date_from: string
  date_to: string
  source: string
  note: string | null
}

export type Expense = {
  id: string
  apartment_id: string | null
  category: string
  description: string
  amount: number
  spent_on: string
  note: string | null
}

export type InventoryItem = {
  id: string
  apartment_id: string
  name: string
  quantity: number
  unit: string
  minimum_quantity: number
  updated_at: string
}
