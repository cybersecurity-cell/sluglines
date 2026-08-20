export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

interface Timestamped { created_at: string; updated_at: string }

export interface Database {
  public: {
    Tables: {
      sources: Table<Timestamped & { id: string; name: string; url: string; source_type: 'official' | 'community' | 'historical' | 'operator'; publisher: string | null; notes: string | null; is_active: boolean }>
      locations: Table<Timestamped & { id: string; slug: string; name: string; corridor: 'I-95/I-395' | 'I-66' | 'Other'; direction: 'inbound' | 'outbound' | 'both'; address: string | null; municipality: string | null; region: string; latitude: number | null; longitude: number | null; parking_details: string | null; transit_details: string | null; operating_notes: string | null; status: 'active' | 'inactive' | 'seasonal' | 'review_needed'; verification_status: 'verified' | 'community_reported' | 'review_needed' | 'historical'; last_verified_at: string | null; source_id: string | null; published: boolean }>
      destinations: Table<Timestamped & { id: string; slug: string; name: string; municipality: string | null; description: string | null; verification_status: 'verified' | 'community_reported' | 'review_needed' | 'historical'; last_verified_at: string | null; source_id: string | null; published: boolean }>
      location_routes: Table<Timestamped & { id: string; location_id: string; destination_id: string; direction: 'inbound' | 'outbound'; peak_start: string | null; peak_end: string | null; schedule_notes: string | null; pickup_notes: string | null; dropoff_notes: string | null; verification_status: 'verified' | 'community_reported' | 'review_needed' | 'historical'; last_verified_at: string | null; source_id: string | null; active: boolean }>
      advisories: Table<Timestamped & { id: string; location_id: string | null; title: string; message: string; severity: 'info' | 'warning' | 'urgent'; status: 'draft' | 'published' | 'expired'; starts_at: string | null; ends_at: string | null; published_at: string | null; verification_status: 'verified' | 'community_reported' | 'review_needed' | 'historical'; last_verified_at: string | null; source_id: string | null }>
      profiles: Table<Timestamped & { id: string; email: string; display_name: string | null; role: 'commuter' | 'steward' | 'editor' | 'admin'; home_location_id: string | null; preferred_destination_id: string | null }>
      saved_locations: Table<{ user_id: string; location_id: string; created_at: string }>
      commute_preferences: Table<Timestamped & { user_id: string; home_location_id: string | null; destination_id: string | null; preferred_direction: 'inbound' | 'outbound' | 'both' | null; email_advisories: boolean }>
      correction_reports: Table<Timestamped & { id: string; user_id: string; location_id: string | null; category: 'location' | 'route' | 'schedule' | 'parking' | 'transit' | 'safety' | 'other'; summary: string; details: string; source_url: string | null; status: 'submitted' | 'reviewing' | 'accepted' | 'rejected'; reviewed_by: string | null; reviewed_at: string | null }>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
