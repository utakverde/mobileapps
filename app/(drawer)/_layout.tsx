import React from 'react';
import { Drawer } from 'expo-router/drawer';
import DrawerContent from '@components/layout/DrawerContent';

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={() => <DrawerContent />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          width: 290,
        },
        swipeEdgeWidth: 60,
      }}
    >
      <Drawer.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="utility-hub" options={{ title: 'Utility Hub' }} />
      <Drawer.Screen name="utility-consumer-management" options={{ title: 'Consumer Management' }} />
      <Drawer.Screen name="utility-new-connection" options={{ title: 'New Connection Processing' }} />
      <Drawer.Screen name="utility-rates-schedules" options={{ title: 'Rates & Scheduling' }} />
      <Drawer.Screen name="utility-meter-reading" options={{ title: 'Meter Reading' }} />
      <Drawer.Screen name="utility-bill-creation" options={{ title: 'Bill Creation' }} />
      <Drawer.Screen name="utility-bill-adjustment" options={{ title: 'Bill Update / Adjustment' }} />
      <Drawer.Screen name="utility-operations" options={{ title: 'Utility Operations' }} />
      <Drawer.Screen name="utility-consumers" options={{ title: 'Consumer and Bill View' }} />
      <Drawer.Screen name="utility-bill-audit/[id]" options={{ title: 'Bill Audit' }} />
      <Drawer.Screen name="utility-bill-correction/[id]" options={{ title: 'Bill Correction Preview' }} />
      <Drawer.Screen name="utility-collections" options={{ title: 'Collections Summary' }} />
      <Drawer.Screen name="utility-complaints" options={{ title: 'Complaints' }} />
      <Drawer.Screen name="utility-service-status" options={{ title: 'Service Status' }} />
      <Drawer.Screen name="utility-financial-analysis" options={{ title: 'Financial Analysis' }} />
      <Drawer.Screen name="utility-system-map" options={{ title: 'System Map Integration' }} />
      <Drawer.Screen name="utility-accounting-integration" options={{ title: 'Accounting Integration' }} />
      <Drawer.Screen name="utility-reconciliation" options={{ title: 'Reconciliation' }} />
      <Drawer.Screen name="reports" options={{ title: 'Reports' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
      <Drawer.Screen name="search" options={{ title: 'Search' }} />
      <Drawer.Screen name="disconnection" options={{ title: 'Disconnection' }} />
      <Drawer.Screen name="utility-reconnection" options={{ title: 'Reconnection' }} />
      <Drawer.Screen name="utility-lifeline-senior" options={{ title: 'Lifeline and Senior' }} />
      <Drawer.Screen name="utility-net-metering" options={{ title: 'Net Metering' }} />
      <Drawer.Screen name="utility-audit-trail" options={{ title: 'Audit Trail' }} />
      <Drawer.Screen name="bluetooth" options={{ title: 'Bluetooth Printer' }} />
      <Drawer.Screen name="sqlite" options={{ title: 'SQLite Manager' }} />
      <Drawer.Screen name="sync" options={{ title: 'Online Sync' }} />
      <Drawer.Screen name="sms" options={{ title: 'SMS Center' }} />
      <Drawer.Screen name="reading/[id]" options={{ title: 'Reading' }} />
      <Drawer.Screen name="net-metering/[id]" options={{ title: 'Net Metering' }} />
      <Drawer.Screen name="invoice/[id]" options={{ title: 'Invoice Preview' }} />
      <Drawer.Screen name="payment/[id]" options={{ title: 'Payment' }} />
      <Drawer.Screen name="map/[id]" options={{ title: 'Map View' }} />
      <Drawer.Screen name="complaint/[id]" options={{ title: 'Complaint' }} />
      <Drawer.Screen name="receipt/[id]" options={{ title: 'Receipt Preview' }} />
      <Drawer.Screen name="bill/[id]" options={{ title: 'Bill Preview' }} />
    </Drawer>
  );
}
