import { describe, expect, it } from "@jest/globals";
import { generateSchedule, AllocationTopic } from "./allocation";

describe("Allocation Utilities", () => {
  const startDate = new Date("2026-10-01T12:00:00Z");

  it("should return empty array if no topics provided", () => {
    const planned = generateSchedule([], 120, startDate);
    expect(planned).toEqual([]);
  });

  it("should enforce session chunking and max limits", () => {
    const topics: AllocationTopic[] = [
      { id: "topic1", subjectId: "sub1", priorityScore: 1.0, remainingMinutes: 150 },
    ];
    
    const planned = generateSchedule(topics, 150, startDate, 1);
    
    // Topic needs 150 mins. Daily is 150 mins. Max session is 60.
    // It should break it down into 60 + 60 + 30.
    expect(planned.length).toBe(3);
    expect(planned[0]!.durationMinutes).toBe(60);
    expect(planned[1]!.durationMinutes).toBe(60);
    expect(planned[2]!.durationMinutes).toBe(30);
  });

  it("should interleave subjects if priorities are close", () => {
    const topics: AllocationTopic[] = [
      { id: "topic1", subjectId: "sub1", priorityScore: 1.0, remainingMinutes: 60 },
      { id: "topic2", subjectId: "sub1", priorityScore: 0.95, remainingMinutes: 60 },
      { id: "topic3", subjectId: "sub2", priorityScore: 0.9, remainingMinutes: 60 },
    ];
    
    // topic1 and topic2 are same subject. topic3 is different subject.
    // Order should be: topic1, then topic3 (interleaving kicks in because 0.9 >= 0.7 * 1.0), then topic2.
    const planned = generateSchedule(topics, 180, startDate, 1);
    
    expect(planned.length).toBe(3);
    expect(planned[0]!.topicId).toBe("topic1");
    expect(planned[1]!.topicId).toBe("topic3");
    expect(planned[2]!.topicId).toBe("topic2");
  });
});
