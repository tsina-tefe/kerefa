<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class KitchenBarTicket extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'order_id',
        'order_station_id',
        'ticket_number',
        'department',
        'status',
        'sent_at',
        'started_at',
        'ready_at',
        'collected_at',
        'reprint_count',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'started_at' => 'datetime',
            'ready_at' => 'datetime',
            'collected_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Order, $this>
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * @return BelongsTo<OrderStation, $this>
     */
    public function orderStation(): BelongsTo
    {
        return $this->belongsTo(OrderStation::class);
    }

    /**
     * @return HasMany<TicketItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(TicketItem::class, 'ticket_id');
    }
}
