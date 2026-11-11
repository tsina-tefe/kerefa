<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TicketItem extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'ticket_id',
        'order_item_id',
        'quantity',
        'special_instructions',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
        ];
    }

    /**
     * @return BelongsTo<KitchenBarTicket, $this>
     */
    public function ticket(): BelongsTo
    {
        return $this->belongsTo(KitchenBarTicket::class, 'ticket_id');
    }

    /**
     * @return BelongsTo<OrderItem, $this>
     */
    public function orderItem(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class);
    }
}
