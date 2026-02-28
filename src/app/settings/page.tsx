"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserStatusTab } from "@/components/settings/user-status-tab";
import { PointTypesTab } from "@/components/settings/point-types-tab";
import { HotelChainsTab } from "@/components/settings/hotel-chains-tab";
import { BenefitValuationsTab } from "@/components/settings/benefit-valuations-tab";
import { CreditCardsTab } from "@/components/settings/credit-cards-tab";
import { ShoppingPortalsTab } from "@/components/settings/shopping-portals-tab";
import { OtaAgenciesTab } from "@/components/settings/ota-agencies-tab";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Tabs defaultValue="my-status" className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-full justify-start md:w-auto md:inline-flex min-w-max">
            <TabsTrigger value="my-status" data-testid="tab-trigger-my-status">
              My Status
            </TabsTrigger>
            <TabsTrigger value="point-types" data-testid="tab-trigger-point-types">
              Point Types
            </TabsTrigger>
            <TabsTrigger value="hotels" data-testid="tab-trigger-hotels">
              Hotel Chains
            </TabsTrigger>
            <TabsTrigger value="valuations" data-testid="tab-trigger-valuations">
              Valuations
            </TabsTrigger>
            <TabsTrigger value="credit-cards" data-testid="tab-trigger-credit-cards">
              Credit Cards
            </TabsTrigger>
            <TabsTrigger value="portals" data-testid="tab-trigger-portals">
              Shopping Portals
            </TabsTrigger>
            <TabsTrigger value="ota-agencies" data-testid="tab-trigger-ota-agencies">
              OTA Agencies
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="my-status" data-testid="tab-my-status">
          <UserStatusTab />
        </TabsContent>
        <TabsContent value="point-types" data-testid="tab-point-types">
          <PointTypesTab />
        </TabsContent>
        <TabsContent value="hotels" data-testid="tab-hotels">
          <HotelChainsTab />
        </TabsContent>
        <TabsContent value="valuations" data-testid="tab-valuations">
          <BenefitValuationsTab />
        </TabsContent>
        <TabsContent value="credit-cards" data-testid="tab-credit-cards">
          <CreditCardsTab />
        </TabsContent>
        <TabsContent value="portals" data-testid="tab-portals">
          <ShoppingPortalsTab />
        </TabsContent>
        <TabsContent value="ota-agencies" data-testid="tab-ota-agencies">
          <OtaAgenciesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
