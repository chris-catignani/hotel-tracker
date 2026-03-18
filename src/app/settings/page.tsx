"use client";

import { useSession } from "next-auth/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserStatusTab } from "@/components/settings/user-status-tab";
import { PointTypesTab } from "@/components/settings/point-types-tab";
import { HotelChainsTab } from "@/components/settings/hotel-chains-tab";
import { CreditCardsTab } from "@/components/settings/credit-cards-tab";
import { ShoppingPortalsTab } from "@/components/settings/shopping-portals-tab";
import { OtaAgenciesTab } from "@/components/settings/ota-agencies-tab";
import { PropertiesTab } from "@/components/settings/properties-tab";

export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-6">
      <h1 className="text-2xl font-bold shrink-0">Settings</h1>
      <Tabs defaultValue="my-status" className="w-full flex-1 min-h-0">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-full justify-start md:w-auto md:inline-flex min-w-max">
            <TabsTrigger value="my-status">My Status</TabsTrigger>
            <TabsTrigger value="point-types">Point Types</TabsTrigger>
            <TabsTrigger value="hotels">Hotel Chains</TabsTrigger>
            <TabsTrigger value="credit-cards">Credit Cards</TabsTrigger>
            <TabsTrigger value="portals">Shopping Portals</TabsTrigger>
            <TabsTrigger value="ota-agencies">OTA Agencies</TabsTrigger>
            {isAdmin && <TabsTrigger value="properties">Properties</TabsTrigger>}
          </TabsList>
        </div>
        <TabsContent
          className="flex-1 min-h-0 flex flex-col"
          value="my-status"
          data-testid="tab-my-status"
        >
          <UserStatusTab />
        </TabsContent>
        <TabsContent
          className="flex-1 min-h-0 flex flex-col"
          value="point-types"
          data-testid="tab-point-types"
        >
          <PointTypesTab />
        </TabsContent>
        <TabsContent
          className="flex-1 min-h-0 flex flex-col"
          value="hotels"
          data-testid="tab-hotels"
        >
          <HotelChainsTab />
        </TabsContent>
        <TabsContent
          className="flex-1 min-h-0 flex flex-col"
          value="credit-cards"
          data-testid="tab-credit-cards"
        >
          <CreditCardsTab />
        </TabsContent>
        <TabsContent
          className="flex-1 min-h-0 flex flex-col"
          value="portals"
          data-testid="tab-portals"
        >
          <ShoppingPortalsTab />
        </TabsContent>
        <TabsContent
          className="flex-1 min-h-0 flex flex-col"
          value="ota-agencies"
          data-testid="tab-ota-agencies"
        >
          <OtaAgenciesTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent
            className="flex-1 min-h-0 flex flex-col"
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
