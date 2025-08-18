# EOL(줄바꿈) 문제 빠른 해결
1) 이 폴더를 레포 루트에 덮어쓰기
2) 한 번 실행: git add --renormalize . && git commit -m "normalize EOL"
3) 필요하면: node scripts/normalize-eol.mjs
4) 치환 실패 시: node scripts/safe-replace.mjs src/lib/classify.ts "findRegExp" "replacement"
