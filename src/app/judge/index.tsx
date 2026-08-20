import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { JudgeDutyMode } from '@/features/judge/types';
import { getDutyMode, clearJudgeStore } from '@/features/judge/services/judgeStore';

import CheckInDeskMode from '@/features/judge/components/CheckInDeskMode';
import StationJudgeMode from '@/features/judge/components/StationJudgeMode';

export default function JudgeDashboard() {
  const router = useRouter();
  const { user, logout, accessToken } = useAuth();
  
  const getInitialDutyMode = (): JudgeDutyMode => {
    const saved = getDutyMode();
    if (saved) return saved;

    const judgeRole = (user?.judgeRoleCode || '').toUpperCase();
    const systemRole = (user?.role || '').toUpperCase();

    if (judgeRole.includes('CHECK_IN') || judgeRole.includes('CHECKIN') || judgeRole.includes('RECEPTION')) {
      return 'CHECK_IN';
    }
    if (systemRole.includes('CHECK_IN') || systemRole.includes('CHECKIN') || systemRole.includes('RECEPTION')) {
      return 'CHECK_IN';
    }
    return 'STATION';
  };

  const [dutyMode] = useState<JudgeDutyMode>(getInitialDutyMode);

  const handleLogout = () => {
    clearJudgeStore();
    logout();
    router.replace('/login');
  };

  return (
    <>
      {dutyMode === 'CHECK_IN' ? (
        <CheckInDeskMode
          token={accessToken}
          onLogout={handleLogout}
        />
      ) : (
        <StationJudgeMode
          token={accessToken}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
