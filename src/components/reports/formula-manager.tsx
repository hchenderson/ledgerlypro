

"use client";

import React, { useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import FormulaBuilder from "@/components/reports/formula-builder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Calculator } from "lucide-react";
import type { Formula } from '@/types';

interface FormulaManagerProps {
    formulas: Formula[];
    onAddFormula: (name: string, expression: string) => Promise<boolean>;
    onDeleteFormula: (id: string) => void;
    availableVariables: string[];
}

export default function FormulaManager({
    formulas,
    onAddFormula,
    onDeleteFormula,
    availableVariables
}: FormulaManagerProps) {
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);

    const sampleContext = useMemo(() => {
        const context: Record<string, number> = {};
        (availableVariables || []).forEach(v => {
            context[v] = Math.floor(Math.random() * 1000);
        });
        return context;
    }, [availableVariables]);

    return (
        <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Calculator className="h-4 w-4 mr-2" />
                    Formula Builder
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Formula Builder</DialogTitle>
                    <DialogDescription>
                        Create custom calculations for your metric cards.
                    </DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="create">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="create">Create Formula</TabsTrigger>
                        <TabsTrigger value="existing">Manage Formulas ({formulas.length})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="create" className="pt-4">
                        <FormulaBuilder
                            availableVariables={availableVariables}
                            sampleContext={sampleContext}
                            onAddFormula={onAddFormula}
                        />
                    </TabsContent>
                    <TabsContent value="existing" className="pt-4">
                        {formulas.length === 0 ? (
                            <div className="text-sm text-muted-foreground p-4 border rounded-md text-center">
                                No formulas created yet.
                            </div>
                        ) : (
                            <ScrollArea className="h-72">
                                <div className="space-y-2">
                                    {formulas.map(formula => (
                                        <div key={formula.id} className="flex items-center justify-between p-3 border rounded-md">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold truncate">{formula.name}</p>
                                                <p className="text-xs text-muted-foreground font-mono truncate">
                                                    {formula.expression}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onDeleteFormula(formula.id)}
                                                className="flex-shrink-0 ml-2"
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
