// ChatUI 디버깅용 테스트 파일
// 브라우저 콘솔에서 실행하여 정규식 테스트

// 테스트할 AI 응답 예시들
const testResponses = [
  // 기본 형식
  `여기 노트 수정을 제안해드릴게요!

\`\`\`suggestion
기존 내용
베르누이 방정식은 유체의 속도와 압력의 관계를 나타낸다.
===>
새로운 내용
베르누이 방정식은 점성과 압축성이 없는 이상적인 유체가 규칙적으로 흐를 때, 속력과 압력, 위치 에너지 사이의 관계를 나타내는 법칙입니다.
\`\`\`

이렇게 수정하면 더 정확해요!`,

  // 공백이 많은 형식
  `\`\`\`suggestion

기존 내용

베르누이 방정식은 유체의 속도와 압력의 관계를 나타낸다.

===>

새로운 내용

베르누이 방정식은 점성과 압축성이 없는 이상적인 유체가 규칙적으로 흐를 때, 속력과 압력, 위치 에너지 사이의 관계를 나타내는 법칙입니다.

\`\`\``,

  // Windows 줄바꿈 형식
  "```suggestion\r\n기존 내용\r\n베르누이 방정식은 유체의 속도와 압력의 관계를 나타낸다.\r\n===>\r\n새로운 내용\r\n베르누이 방정식은 점성과 압축성이 없는 이상적인 유체가 규칙적으로 흐를 때, 속력과 압력, 위치 에너지 사이의 관계를 나타내는 법칙입니다.\r\n```"
];

// 다양한 정규식 패턴들
const regexPatterns = [
  // 기존 패턴
  /```suggestion\s*\r?\n기존 내용\s*\r?\n([\s\S]*?)\s*\r?\n===>\s*\r?\n새로운 내용\s*\r?\n([\s\S]*?)\s*```/,
  
  // 더 유연한 패턴들
  /```suggestion\s*[\r\n]+기존\s*내용\s*[\r\n]+([\s\S]*?)[\r\n]+==+>\s*[\r\n]+새로운\s*내용\s*[\r\n]+([\s\S]*?)[\r\n]*```/,
  
  /```suggestion\s*(?:\r?\n)+기존\s*내용\s*(?:\r?\n)+([\s\S]*?)\s*(?:\r?\n)+==+>\s*(?:\r?\n)+새로운\s*내용\s*(?:\r?\n)+([\s\S]*?)\s*```/,
  
  /```suggestion[\s\S]*?기존\s*내용[\s\S]*?([\s\S]*?)[\s\S]*?==+>[\s\S]*?새로운\s*내용[\s\S]*?([\s\S]*?)[\s\S]*?```/,
];

// 테스트 함수
function testSuggestionMatching() {
  console.log('🧪 AI 노트 수정 제안 정규식 테스트 시작!');
  console.log('=====================================');
  
  testResponses.forEach((response, responseIndex) => {
    console.log(`\n📝 테스트 응답 #${responseIndex + 1}:`);
    console.log(response.substring(0, 100) + '...');
    
    regexPatterns.forEach((pattern, patternIndex) => {
      const match = response.match(pattern);
      console.log(`\n🔍 패턴 #${patternIndex + 1}: ${match ? '✅ 매치됨' : '❌ 매치 안됨'}`);
      
      if (match) {
        console.log('   📤 기존 내용:', JSON.stringify(match[1].trim()));
        console.log('   📥 새로운 내용:', JSON.stringify(match[2].trim()));
      }
    });
    
    console.log('\n' + '-'.repeat(50));
  });
}

// 실제 AI 응답 테스트 함수 (콘솔에서 호출용)
function testActualResponse(aiResponse) {
  console.log('🔬 실제 AI 응답 테스트:');
  console.log('응답 길이:', aiResponse.length);
  console.log('첫 100자:', aiResponse.substring(0, 100));
  console.log('마지막 100자:', aiResponse.substring(aiResponse.length - 100));
  console.log('\n특수 문자 분석:');
  console.log('\\r 포함:', aiResponse.includes('\r'));
  console.log('\\n 포함:', aiResponse.includes('\n'));
  console.log('suggestion 블록 포함:', aiResponse.includes('```suggestion'));
  console.log('기존 내용 포함:', aiResponse.includes('기존 내용'));
  console.log('====> 포함:', aiResponse.includes('===>'));
  console.log('새로운 내용 포함:', aiResponse.includes('새로운 내용'));
  
  console.log('\n정규식 테스트:');
  regexPatterns.forEach((pattern, index) => {
    const match = aiResponse.match(pattern);
    console.log(`패턴 ${index + 1}: ${match ? '✅' : '❌'}`, match ? match.slice(1, 3) : null);
  });
}

// 브라우저 콘솔에서 사용법:
console.log('📋 사용법:');
console.log('1. testSuggestionMatching() - 기본 테스트 실행');
console.log('2. testActualResponse("실제AI응답텍스트") - 실제 응답 분석');

// 바로 테스트 실행
testSuggestionMatching();