import { SessionType } from "@prisma/client";

export interface AllocationTopic {
  id: string;
  priorityScore: number;
  remainingMinutes: number;
}

export interface PlannedSession {
  topicId: string;
  date: Date;
  startTime: string;
  durationMinutes: number;
  sessionType: SessionType;
}

export function generateSchedule(
  topics: AllocationTopic[],
  dailyCapacityMinutes: number,
  startDate: Date,
  daysToPlan: number = 30
): PlannedSession[] {
  const planned: PlannedSession[] = [];
  const MIN_SESSION_MINUTES = 30;
  const BREAK_MINUTES = 15;
  
  let activeTopics = topics.map(t => ({ ...t })).filter(t => t.remainingMinutes > 0);
  
  for (let dayOffset = 0; dayOffset < daysToPlan; dayOffset++) {
    if (activeTopics.length === 0) break;

    const date = new Date(startDate);
    date.setUTCDate(startDate.getUTCDate() + dayOffset);
    
    let remainingDailyCapacity = dailyCapacityMinutes;
    let currentHour = 9;
    let currentMinute = 0;
    
    activeTopics.sort((a, b) => b.priorityScore - a.priorityScore);
    const totalPriority = activeTopics.reduce((sum, t) => sum + t.priorityScore, 0);
    
    for (const topic of activeTopics) {
      if (remainingDailyCapacity < MIN_SESSION_MINUTES) break;
      if (topic.remainingMinutes <= 0) continue;
      
      const shareRatio = totalPriority > 0 ? (topic.priorityScore / totalPriority) : (1 / activeTopics.length);
      let allocatedMinutes = Math.floor(dailyCapacityMinutes * shareRatio);
      
      if (allocatedMinutes < MIN_SESSION_MINUTES) {
        allocatedMinutes = MIN_SESSION_MINUTES; 
      }
      if (allocatedMinutes > remainingDailyCapacity) {
        allocatedMinutes = remainingDailyCapacity;
      }
      if (allocatedMinutes > topic.remainingMinutes) {
        allocatedMinutes = topic.remainingMinutes;
      }
      
      const startTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
      
      planned.push({
        topicId: topic.id,
        date,
        startTime: startTimeStr,
        durationMinutes: allocatedMinutes,
        sessionType: SessionType.STUDY,
      });
      
      topic.remainingMinutes -= allocatedMinutes;
      remainingDailyCapacity -= allocatedMinutes;
      
      currentMinute += allocatedMinutes + BREAK_MINUTES;
      while (currentMinute >= 60) {
        currentHour += 1;
        currentMinute -= 60;
      }
    }
    
    activeTopics = activeTopics.filter(t => t.remainingMinutes > 0);
  }
  
  return planned;
}

