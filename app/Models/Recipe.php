<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Recipe extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'menu_item_id',
        'name',
        'yield_portions',
        'total_cost',
        'cost_per_portion',
        'food_cost_percentage',
        'instructions',
        'is_active',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'yield_portions' => 'decimal:2',
            'total_cost' => 'decimal:4',
            'cost_per_portion' => 'decimal:4',
            'food_cost_percentage' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<MenuItem, $this>
     */
    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class);
    }

    /**
     * @return HasMany<RecipeIngredient, $this>
     */
    public function ingredients(): HasMany
    {
        return $this->hasMany(RecipeIngredient::class);
    }
}
