<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RestaurantTable extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'dining_area_id',
        'table_number',
        'capacity',
        'status',
        'merged_with_table_id',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    /**
     * @return BelongsTo<DiningArea, $this>
     */
    public function diningArea(): BelongsTo
    {
        return $this->belongsTo(DiningArea::class);
    }

    /**
     * @return BelongsTo<RestaurantTable, $this>
     */
    public function mergedWith(): BelongsTo
    {
        return $this->belongsTo(self::class, 'merged_with_table_id');
    }

    /**
     * @return HasMany<Order, $this>
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /**
     * @return HasOne<Order, $this>
     */
    public function activeOrder(): HasOne
    {
        return $this->hasOne(Order::class)->ofMany(
            ['id' => 'max'],
            fn ($query) => $query->whereNotIn('status', ['completed', 'cancelled']),
        );
    }

    /**
     * @return array<string, string>
     */
    public static function statuses(): array
    {
        return [
            'available' => 'Available',
            'occupied' => 'Occupied',
            'reserved' => 'Reserved',
            'maintenance' => 'Maintenance',
        ];
    }
}
