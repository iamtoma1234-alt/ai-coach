/**
 * WebアプリのURLにアクセスしたときに画面（index.html）を表示する必須の関数です
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('AI English Coach')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * サーバー側（GAS）でGemini APIを実行し、スプレッドシートに履歴を保存する関数
 * （※今回は主にブラウザ側でAPIを処理しますが、スプレッドシートへの保存機能を使いたい場合のために記述しておきます）
 */
function processSpeech(userInput, clientApiKey) {
  if (!clientApiKey) {
    throw new Error("Gemini APIキーが設定されていません。画面右上から設定してください。");
  }

  const systemPrompt = `You are an elite native English coach. Analyze the user's input.
If the input is Japanese, translate it to natural, native English.
If the input is broken/awkward English, refine it into natural native expressions.
Provide two stylistic options: Casual (for daily talk) and Formal (for business/polite settings).

You MUST respond strictly in the following JSON format. Do not wrap it in markdown codeblocks. Do not add any greeting or extra text outside this JSON:
{
  "original": "The original input text",
  "native_casual": "Natural daily casual English phrase",
  "native_formal": "Professional/polite English phrase",
  "tips": "Brief 1-sentence Japanese explanation of the difference or nuance"
}`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${clientApiKey}`;
  
  const payload = {
    contents: [{
      parts: [
        { text: systemPrompt },
        { text: `User Input: "${userInput}"` }
      ]
    }]
  };

  const options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (responseCode !== 200) {
      throw new Error(`API Error: ${responseText}`);
    }

    const resJson = JSON.parse(responseText);
    let resultText = resJson.candidates[0].content.parts[0].text.trim();
    resultText = resultText.replace(/^```json/, "").replace(/```$/, "").trim();
    const resultObj = JSON.parse(resultText);

    // 【オプション】Googleスプレッドシートに履歴を残す機能
    try {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
      sheet.appendRow([
        new Date(), 
        resultObj.original, 
        resultObj.native_casual, 
        resultObj.native_formal, 
        resultObj.tips
      ]);
    } catch(e) {
      // シート連携がなくてもアプリ自体は動くようにエラーを無視
      Logger.log("シートへの書き込みをスキップしました");
    }

    return resultObj;

  } catch (error) {
    throw new Error("処理に失敗しました: " + error.message);
  }
}