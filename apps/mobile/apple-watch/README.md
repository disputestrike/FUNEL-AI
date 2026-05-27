# Apple Watch companion — watchOS

A minimal companion built on the iOS widget data layer. The watch app does
NOT have its own network stack — it reads from the App Group container that
the iOS app keeps fresh.

## Surfaces

1. **Glance / Smart Stack** — same `TodayLeadsView` we render in the iOS
   home widget, sized to fit a watch face. Real-time refresh on push.
2. **Main app** — single screen showing today's lead count, conversion
   sparkline, and a list of the latest five leads. Tapping a lead opens a
   detail view with two quick actions:
   - **Mark contacted** — POSTs to `/v1/leads/:id/contacted`.
   - **Call** — hands off to the paired iPhone via Handoff. The iPhone
     opens the same `tel:` URL we use in the main app's lead detail.
3. **Push notifications** — `lead.new` payloads include two
   `UNNotificationAction`s:
   - `MARK_CONTACTED` — fires the same /contacted endpoint silently.
   - `CALL` — Handoff to iPhone, opens dialer.

## Files

- `FunnelWatch/FunnelWatchApp.swift` — entry point, SwiftUI scenes.
- `FunnelWatch/Models/WidgetSnapshot.swift` — same Codable as the iOS widget.
- `FunnelWatch/Views/HomeView.swift` — lead count + sparkline.
- `FunnelWatch/Views/LeadListView.swift` — last five leads.
- `FunnelWatch/Notifications/NotificationActions.swift` — quick-action wiring.

## Build

The watchOS target is added to the same Xcode project as the iOS app and the
WidgetKit extension. EAS Build picks it up automatically via the iOS scheme.
