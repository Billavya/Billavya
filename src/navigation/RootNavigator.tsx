import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "@/screens/HomeScreen";
import { InsightsScreen } from "@/screens/InsightsScreen";
import { SearchScreen } from "@/screens/SearchScreen";
import { SearchResultsScreen } from "@/screens/SearchResultsScreen";
import { FoldersScreen } from "@/screens/FoldersScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { FolderDetailScreen } from "@/screens/FolderDetailScreen";
import { ExclusiveDetailScreen } from "@/screens/ExclusiveDetailScreen";
import { CustomTabBar } from "@/navigation/CustomTabBar";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabsNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Folders" component={FoldersScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      <Stack.Screen name="FolderDetail" component={FolderDetailScreen} />
      <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
      <Stack.Screen name="ExclusiveDetail" component={ExclusiveDetailScreen} />
    </Stack.Navigator>
  );
}
