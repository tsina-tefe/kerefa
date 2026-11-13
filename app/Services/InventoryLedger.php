<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\InventoryStock;
use App\Models\StockTransaction;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class InventoryLedger
{
    public function move(
        InventoryItem $item,
        int $branchId,
        string $type,
        float $quantity,
        ?User $user = null,
        ?string $notes = null,
        ?Model $reference = null,
    ): InventoryStock {
        if (! in_array($type, ['in', 'out', 'wastage', 'adjustment'], true)) {
            throw ValidationException::withMessages([
                'type' => ['Choose a stock movement type.'],
            ]);
        }

        if ($quantity <= 0) {
            throw ValidationException::withMessages([
                'quantity' => ['Enter a quantity greater than zero.'],
            ]);
        }

        $stock = InventoryStock::query()->firstOrCreate(
            ['branch_id' => $branchId, 'inventory_item_id' => $item->id],
            ['current_stock' => 0, 'min_stock_level' => 0],
        );

        $current = (float) $stock->current_stock;
        $next = $type === 'in' ? $current + $quantity : $current - $quantity;

        if ($next < -0.0001) {
            throw ValidationException::withMessages([
                'quantity' => ['Only '.number_format($current, 2).' '.$item->unit.' is on hand.'],
            ]);
        }

        $next = round(max(0, $next), 4);
        $stock->update(['current_stock' => $next]);

        StockTransaction::query()->create([
            'branch_id' => $branchId,
            'inventory_item_id' => $item->id,
            'type' => $type,
            'quantity' => $quantity,
            'balance_after' => $next,
            'unit_cost' => $item->unit_cost,
            'total_cost' => round($quantity * (float) $item->unit_cost, 4),
            'user_id' => $user?->id,
            'reference_type' => $reference ? $reference::class : null,
            'reference_id' => $reference?->getKey(),
            'notes' => $notes,
        ]);

        return $stock->fresh();
    }
}
