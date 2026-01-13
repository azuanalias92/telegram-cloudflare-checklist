export default {
  async fetch(request: Request, env: any) {
    const body:any = await request.json();

    // Handle button clicks (callback_query)
    if (body.callback_query) {
      const callback = body.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const data = callback.data; // e.g., "done_0_2026-01-13"

      // Format: done_{index}_{date}_{chatId}
      const [_, index, date] = data.split("_");

      // Retrieve done items
      const doneKey = `done:${chatId}:${date}`;
      let doneItems: string[] = JSON.parse((await env.CHECKLIST_KV.get(doneKey)) ?? "[]");

      // Add clicked item if not already done
      if (!doneItems.includes(index)) doneItems.push(index);

      // Save updated done items
      await env.CHECKLIST_KV.put(doneKey, JSON.stringify(doneItems));

      // Edit original message to show ✅
      const checklistText = JSON.parse(await env.CHECKLIST_KV.get(`checklist:${date}`) ?? "[]");
      const newText = checklistText
        .map((item: string, i: number) => (doneItems.includes(String(i)) ? `✅ ${item}` : `☐ ${item}`))
        .join("\n");

      await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/editMessageText`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: newText,
          reply_markup: {
            inline_keyboard: checklistText.map((item: string, i: number) => [
              {
                text: doneItems.includes(String(i)) ? `✅ ${item}` : `☐ ${item}`,
                callback_data: `done_${i}_${date}`,
              },
            ]),
          },
        }),
      });

      return new Response("OK");
    }

    // Handle chat commands
    if (body.message && body.message.text) {
      const message = body.message;
      const chatId = message.chat.id;
      const text = message.text.trim();

      // /addlist YYYY-MM-DD Task1;Task2;Task3
      if (text.startsWith("/addlist")) {
        const parts = text.split(" ");
        const date = parts[1];
        const tasks = parts.slice(2).join(" ").split(";").map((t:any) => t.trim());
        if (!date || tasks.length === 0) {
          await sendMessage(chatId, "Usage: /addlist YYYY-MM-DD Task1;Task2;Task3", env);
          return new Response("OK");
        }

        // Save checklist in KV
        await env.CHECKLIST_KV.put(`checklist:${date}`, JSON.stringify(tasks));
        await sendMessage(chatId, `✅ Checklist saved for ${date}`, env);
        return new Response("OK");
      }

      // /removelist YYYY-MM-DD
      if (text.startsWith("/removelist")) {
        const parts = text.split(" ");
        const date = parts[1];
        if (!date) {
          await sendMessage(chatId, "Usage: /removelist YYYY-MM-DD", env);
          return new Response("OK");
        }

        await env.CHECKLIST_KV.delete(`checklist:${date}`);
        await sendMessage(chatId, `✅ Checklist removed for ${date}`, env);
        return new Response("OK");
      }

      // /list YYYY-MM-DD
      if (text.startsWith("/list")) {
        const parts = text.split(" ");
        const date = parts[1];
        if (!date) {
          await sendMessage(chatId, "Usage: /list YYYY-MM-DD", env);
          return new Response("OK");
        }

        const checklist: string[] = JSON.parse(await env.CHECKLIST_KV.get(`checklist:${date}`) ?? "[]");
        await sendMessage(chatId, checklist.length > 0 ? checklist.join("\n") : "No checklist for this date", env);
        return new Response("OK");
      }

      await sendMessage(chatId, "Unknown command", env);
      return new Response("OK");
    }

    return new Response("OK");
  },

  // Scheduled cron: send today's checklist
  async scheduled(_event: any, env: any) {
    const now = new Date(Date.now() + 8 * 60 * 60 * 1000); // UTC+8
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // Get daily checklist (default + special)
    let checklist: string[] = JSON.parse((await env.CHECKLIST_KV.get(`checklist:${dateStr}`)) ?? "[]");

    if (checklist.length === 0) {
      // fallback daily checklist by weekday
      const weekdays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const dayKey = `checklist:${weekdays[now.getUTCDay()]}`;
      checklist = JSON.parse((await env.CHECKLIST_KV.get(dayKey)) ?? "[]");
    }

    if (checklist.length === 0) checklist = ["📝 No checklist configured for today"];

    // Save checklist for today's ticking
    await env.CHECKLIST_KV.put(`checklist:${dateStr}`, JSON.stringify(checklist));

    // Send checklist to Telegram
    await sendChecklist(env.TG_CHAT_ID, checklist, env, dateStr);
  },
};

// Helper functions
async function sendMessage(chatId: number | string, text: string, env: any) {
  await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendChecklist(chatId: number | string, checklistItems: string[], env: any, dateStr: string) {
  const buttons = checklistItems.map((item, i) => [
    { text: `☐ ${item}`, callback_data: `done_${i}_${dateStr}` },
  ]);

  await fetch(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: checklistItems.map((i) => `☐ ${i}`).join("\n"),
      reply_markup: { inline_keyboard: buttons },
    }),
  });
}
