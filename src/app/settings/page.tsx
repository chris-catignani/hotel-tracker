"use client";

import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserStatusTab } from "@/components/settings/user-status-tab";
import { PointTypesTab } from "@/components/settings/point-types-tab";
import { HotelChainsTab } from "@/components/settings/hotel-chains-tab";
import { CreditCardsTab } from "@/components/settings/credit-cards-tab";
import { ShoppingPortalsTab } from "@/components/settings/shopping-portals-tab";
import { OtaAgenciesTab } from "@/components/settings/ota-agencies-tab";
import { MyCardsTab } from "@/components/settings/my-cards-tab";
import { PropertiesTab } from "@/components/settings/properties-tab";

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your cards, statuses, and reference data.</p>
      </div>
      <Tabs defaultValue="my-status" className="w-full flex-1 min-h-0">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-full justify-start md:w-auto md:inline-flex min-w-max">
            <TabsTrigger value="my-status">My Status</TabsTrigger>
            <TabsTrigger value="my-cards">My Cards</TabsTrigger>
            <TabsTrigger value="point-types">Point Types</TabsTrigger>
            <TabsTrigger value="hotels">Hotel Chains</TabsTrigger>
            <TabsTrigger value="credit-cards">Credit Cards</TabsTrigger>
            <TabsTrigger value="portals">Shopping Portals</TabsTrigger>
            <TabsTrigger value="ota-agencies">OTA Agencies</TabsTrigger>
            {isAdmin && <TabsTrigger value="properties">Properties</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent
          className="min-h-0 flex flex-col"
          value="my-status"
          data-testid="tab-my-status"
        >
          <UserStatusTab />
        </TabsContent>
        <TabsContent className="min-h-0 flex flex-col" value="my-cards" data-testid="tab-my-cards">
          <MyCardsTab />
        </TabsContent>
        <TabsContent
          className="min-h-0 flex flex-col"
          value="point-types"
          data-testid="tab-point-types"
        >
          <PointTypesTab />
        </TabsContent>
        <TabsContent className="min-h-0 flex flex-col" value="hotels" data-testid="tab-hotels">
          <HotelChainsTab />
        </TabsContent>
        <TabsContent
          className="min-h-0 flex flex-col"
          value="credit-cards"
          data-testid="tab-credit-cards"
        >
          <CreditCardsTab />
        </TabsContent>
        <TabsContent className="min-h-0 flex flex-col" value="portals" data-testid="tab-portals">
          <ShoppingPortalsTab />
        </TabsContent>
        <TabsContent
          className="min-h-0 flex flex-col"
          value="ota-agencies"
          data-testid="tab-ota-agencies"
        >
          <OtaAgenciesTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent
            className="min-h-0 flex flex-col"
            value="properties"
            data-testid="tab-properties"
          >
            <PropertiesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
