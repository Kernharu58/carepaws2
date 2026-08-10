import { mergeMessages } from "../app/(tabs)/chat";
import type { ChatMessageData } from "../components/ChatMessage";

function makeMessage(overrides: Partial<ChatMessageData> & { _id: string }): ChatMessageData {
  return {
    sender: "user",
    text: "hello",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mergeMessages (chat REST history + Socket.io live-update merge)", () => {
  it("returns incoming messages when there's nothing existing yet (initial REST load)", () => {
    const incoming = [makeMessage({ _id: "1" }), makeMessage({ _id: "2", createdAt: "2026-01-01T00:01:00.000Z" })];
    const result = mergeMessages([], incoming);
    expect(result.map((m) => m._id)).toEqual(["1", "2"]);
  });

  it("appends a live socket message that arrived after REST history loaded", () => {
    const existing = [makeMessage({ _id: "1", createdAt: "2026-01-01T00:00:00.000Z" })];
    const live = makeMessage({ _id: "2", createdAt: "2026-01-01T00:01:00.000Z" });
    const result = mergeMessages(existing, [live]);
    expect(result.map((m) => m._id)).toEqual(["1", "2"]);
  });

  it("does not duplicate a message that arrives via socket after already being in REST history", () => {
    // This is the exact race the spec calls out: a message that was
    // already included in the REST fetch also gets broadcast live
    // (e.g. the REST call and the socket connection both complete
    // around the same time). Deduping by _id must collapse these to one.
    const shared = makeMessage({ _id: "1", createdAt: "2026-01-01T00:00:00.000Z" });
    const existing = [shared];
    const result = mergeMessages(existing, [shared]);
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("1");
  });

  it("handles the REST fetch resolving AFTER some live messages already arrived", () => {
    // Socket connects and delivers a message before the REST history
    // fetch (which started earlier) actually resolves.
    const liveMessageThatArrivedFirst = makeMessage({ _id: "2", createdAt: "2026-01-01T00:01:00.000Z" });
    const existing = [liveMessageThatArrivedFirst];

    const restHistory = [
      makeMessage({ _id: "1", createdAt: "2026-01-01T00:00:00.000Z" }),
      liveMessageThatArrivedFirst, // REST also includes it, since it was persisted before the fetch ran
    ];

    const result = mergeMessages(existing, restHistory);
    expect(result.map((m) => m._id)).toEqual(["1", "2"]);
    expect(result).toHaveLength(2);
  });

  it("always sorts the merged result by createdAt regardless of arrival order", () => {
    const existing = [makeMessage({ _id: "3", createdAt: "2026-01-01T00:02:00.000Z" })];
    const incoming = [
      makeMessage({ _id: "1", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeMessage({ _id: "2", createdAt: "2026-01-01T00:01:00.000Z" }),
    ];
    const result = mergeMessages(existing, incoming);
    expect(result.map((m) => m._id)).toEqual(["1", "2", "3"]);
  });

  it("lets incoming data win on conflict (e.g. an edited/updated message re-delivered)", () => {
    const existing = [makeMessage({ _id: "1", text: "original" })];
    const updated = makeMessage({ _id: "1", text: "updated" });
    const result = mergeMessages(existing, [updated]);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("updated");
  });
});
