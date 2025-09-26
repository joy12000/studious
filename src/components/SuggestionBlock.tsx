import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
import { ArrowRight, Check, X, BrainCircuit } from 'lucide-react';

interface SuggestionBlockProps {
  oldContent: string;
  newContent: string;
  onAccept: (newContent: string) => void;
  onReject: () => void;
}

const DiffView: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n').map((line, i) => (
    <div key={i} className="break-words whitespace-pre-wrap">{line}</div>
  ));
  return <>{lines}</>;
};

export const SuggestionBlock: React.FC<SuggestionBlockProps> = ({ oldContent, newContent, onAccept, onReject }) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleAccept = () => {
    onAccept(newContent);
    setIsVisible(false);
  };

  const handleReject = () => {
    onReject();
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <Card className="my-4 border-blue-500 border-2 shadow-lg bg-blue-50/30 dark:bg-blue-900/10">
      <CardHeader>
        <CardTitle className="flex items-center text-lg text-blue-600 dark:text-blue-400">
          <BrainCircuit className="w-5 h-5 mr-2" />
          AI의 수정 제안
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-md bg-red-100/50 dark:bg-red-900/20">
          <h4 className="font-semibold text-sm text-red-700 dark:text-red-400 mb-2">기존 내용</h4>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400">
            <DiffView text={oldContent} />
          </div>
        </div>
        
        <div className="flex justify-center items-center">
            <ArrowRight className="w-6 h-6 text-gray-400" />
        </div>

        <div className="p-3 rounded-md bg-green-100/50 dark:bg-green-900/20">
          <h4 className="font-semibold text-sm text-green-700 dark:text-green-400 mb-2">새로운 내용</h4>
          <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
            <DiffView text={newContent} />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        <Button variant="ghost" onClick={handleReject}>
          <X className="w-4 h-4 mr-2" />
          거절
        </Button>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleAccept}>
          <Check className="w-4 h-4 mr-2" />
          수락
        </Button>
      </CardFooter>
    </Card>
  );
};
