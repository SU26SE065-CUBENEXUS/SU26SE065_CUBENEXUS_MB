import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export default function AppTabs() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[theme];
  const TabsComp: any = NativeTabs;

  return (
    <TabsComp
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <TabsComp.Trigger name="index">
        <TabsComp.Trigger.Label>Home</TabsComp.Trigger.Label>
        <TabsComp.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </TabsComp.Trigger>

      <TabsComp.Trigger name="explore">
        <TabsComp.Trigger.Label>Explore</TabsComp.Trigger.Label>
        <TabsComp.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </TabsComp.Trigger>
    </TabsComp>
  );
}
