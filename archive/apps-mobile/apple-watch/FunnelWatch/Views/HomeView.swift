//
//  HomeView.swift â€” watch home glance.
//
//  Reads the shared App Group snapshot the iOS app keeps fresh. No network
//  calls happen on the watch.
//

import SwiftUI
import WatchKit

private let appGroup = "group.com.funnelai.app"
private let snapshotKey = "widget.snapshot"

struct WatchSnapshot: Codable {
    var leadCountToday: Int
    var leadCountYesterday: Int
    var activeFunnels: Int
    var conversionsBy15m: [Int]
    var lastLeadName: String?
}

func loadSnapshot() -> WatchSnapshot? {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let data = defaults.data(forKey: snapshotKey) else { return nil }
    return try? JSONDecoder().decode(WatchSnapshot.self, from: data)
}

struct HomeView: View {
    @State private var snapshot: WatchSnapshot? = loadSnapshot()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Leads today")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                Text("\(snapshot?.leadCountToday ?? 0)")
                    .font(.system(size: 44, weight: .semibold, design: .rounded))
                    .monospacedDigit()

                if let s = snapshot, let name = s.lastLeadName {
                    Divider().padding(.vertical, 4)
                    Text("Last: \(name)")
                        .font(.caption)
                }

                NavigationLink("Open leads", destination: LeadListView())
                    .buttonStyle(.borderedProminent)
                    .tint(Color(red: 0.357, green: 0.310, blue: 1.0))
                    .padding(.top, 8)
            }
            .padding()
        }
        .onAppear { snapshot = loadSnapshot() }
    }
}

struct LeadListView: View {
    var body: some View {
        Text("Open GoFunnelAI on iPhone to see lead details.")
            .font(.caption)
            .foregroundColor(.secondary)
            .padding()
    }
}
