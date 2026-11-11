<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MenuItem extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'category_id',
        'order_station_id',
        'code',
        'name',
        'description',
        'price',
        'cost_price',
        'preparation_department',
        'image_path',
        'is_available',
        'is_active',
        'recipe_enabled',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:4',
            'cost_price' => 'decimal:4',
            'is_available' => 'boolean',
            'is_active' => 'boolean',
            'recipe_enabled' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<MenuCategory, $this>
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(MenuCategory::class, 'category_id');
    }

    /**
     * @return BelongsTo<OrderStation, $this>
     */
    public function orderStation(): BelongsTo
    {
        return $this->belongsTo(OrderStation::class);
    }

    /**
     * @return HasMany<MenuItemModifier, $this>
     */
    public function modifiers(): HasMany
    {
        return $this->hasMany(MenuItemModifier::class);
    }

    /**
     * @return HasMany<Recipe, $this>
     */
    public function recipes(): HasMany
    {
        return $this->hasMany(Recipe::class);
    }
}
