<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SystemSetting extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'branch_id',
        'category',
        'key',
        'value',
        'type',
        'description',
    ];

    /**
     * @return BelongsTo<Branch, $this>
     */
    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public static function get(string $key, mixed $default = null, ?int $branchId = null): mixed
    {
        $setting = static::query()
            ->where('key', $key)
            ->where(function ($query) use ($branchId) {
                $query->where('branch_id', $branchId)->orWhereNull('branch_id');
            })
            ->orderByRaw('case when branch_id is null then 1 else 0 end')
            ->first();

        return $setting?->value ?? $default;
    }
}
